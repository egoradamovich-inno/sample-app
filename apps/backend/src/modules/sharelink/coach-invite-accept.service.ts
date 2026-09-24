import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, ShareLinkType } from '../../../generated/prisma/enums';
import { BCRYPT_COST_FACTOR } from '../../shared/config/bcrypt.constants';
import { AppException } from '../../shared/errors/app-exception';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DuplicateEmailException } from '../auth/exceptions/duplicate-email.exception';
import { TokenService } from '../auth/token.service';
import { AcceptCoachInviteDto } from './dto/accept-coach-invite.dto';
import { RegisterViaLinkResult } from './player-registration.service';
import { ActiveShareLink, ShareLinkService } from './sharelink.service';
import { CoachAlreadyActiveElsewhereException } from './exceptions/coach-already-active-elsewhere.exception';
import { ShareLinkExhaustedException } from './exceptions/sharelink-exhausted.exception';
import { ShareLinkTypeMismatchException } from './exceptions/sharelink-type-mismatch.exception';

interface CoachUser {
  id: string;
  email: string;
  role: Role;
  parentUserId?: string | null;
}

interface PrismaP2002Error {
  code?: string;
  meta?: { target?: string[] | string };
}

function isP2002(error: unknown): error is PrismaP2002Error {
  return (error as PrismaP2002Error)?.code === 'P2002';
}

function p2002Target(error: PrismaP2002Error): string {
  const target = error.meta?.target;
  return Array.isArray(target) ? target.join(',') : (target ?? '');
}

@Injectable()
export class CoachInviteAcceptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
    private readonly shareLinkService: ShareLinkService,
  ) {}

  async acceptInvite(
    code: string,
    dto: AcceptCoachInviteDto,
    currentUser?: AuthenticatedUser,
  ): Promise<RegisterViaLinkResult> {
    const link = await this.shareLinkService.getActiveLinkOrThrow(code);
    if (link.type !== ShareLinkType.UNIQUE) {
      throw new ShareLinkTypeMismatchException();
    }

    const acceptingEmail = currentUser
      ? (await this.loadExistingUser(currentUser.userId)).email
      : dto.email;
    this.assertMatchesTargetEmail(link, acceptingEmail);

    let isNewUser = false;

    let coachUser: CoachUser;
    try {
      coachUser = await this.prisma.$transaction(async (tx) => {
        // Claim the single-use link FIRST, atomically, before creating or
        // touching any user/coach data. The guarded updateMany's WHERE
        // (active: true) can only match for one concurrent transaction —
        // Postgres row-locks the matched ShareLink row for the UPDATE's
        // duration, so a second concurrent accept (even from a different
        // person entirely) sees active already flipped to false and matches
        // zero rows. Claiming before any user creation also means a losing
        // request never leaves behind an orphaned account.
        const claimed = await tx.shareLink.updateMany({
          where: { id: link.id, active: true },
          data: { useCount: { increment: 1 }, active: false },
        });
        if (claimed.count === 0) {
          throw new ShareLinkExhaustedException();
        }

        let user: CoachUser;
        if (currentUser) {
          user = (await tx.user.findUnique({
            where: { id: currentUser.userId },
          })) as CoachUser;
        } else {
          const { email, password, firstName, lastName } = dto;
          if (!email || !password || !firstName || !lastName) {
            throw new AppException(
              'VALIDATION_ERROR',
              'email, password, firstName, and lastName are required to accept this invite',
              400,
            );
          }
          const existing = await tx.user.findUnique({ where: { email } });
          if (existing) {
            throw new DuplicateEmailException();
          }
          // Two concurrent accepts with the same not-yet-registered email
          // can both pass this check before either commits — the P2002
          // catch around the whole transaction (below) is what actually
          // closes that window; this check-then-create is just the fast
          // path for the common (non-racing) case.
          const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
          user = await tx.user.create({
            data: {
              email,
              passwordHash,
              role: Role.COACH,
              // Same frictionless-registration reasoning as player ShareLink
              // registration — a coach invite implies an existing trust
              // relationship with the trainer who sent it.
              emailVerified: true,
              profile: { create: { firstName, lastName } },
            },
          });
          isNewUser = true;
        }

        // Re-checked here, inside the same transaction as the claim and the
        // write — not as an earlier separate read — to close the
        // check-then-act race window a concurrent accept from the same coach
        // could otherwise slip through.
        const existingProfile = (await tx.coachProfile.findUnique({
          where: { userId: user.id },
        })) as { trainerId: string } | null;

        if (existingProfile) {
          if (existingProfile.trainerId !== link.trainerId) {
            throw new CoachAlreadyActiveElsewhereException();
          }
          return user; // Same trainer, already accepted — idempotent no-op.
        }

        // Same check-then-create shape as above, on CoachProfile.userId's
        // unique index this time — a concurrent accept for the SAME user
        // against a different trainer's link can pass the read above
        // before either commits. The P2002 catch below closes that window
        // too.
        await tx.coachProfile.create({
          data: { userId: user.id, trainerId: link.trainerId },
        });
        return user;
      });
    } catch (error) {
      if (isP2002(error)) {
        // Two distinct unique-constraint collisions can surface here, both
        // from a second concurrent request slipping past this
        // transaction's own check-then-create (Postgres only serializes
        // the two at the final INSERT, not at the earlier read):
        //  - CoachProfile.userId: a concurrent accept already
        //    created/claimed this exact user's one-and-only CoachProfile
        //    — the same single-trainer violation the in-transaction
        //    re-check above exists to catch, just resolved one step later.
        //  - User.email: two brand-new registrations racing the same
        //    email — a genuine fresh-registration collision, unrelated to
        //    the single-trainer constraint.
        if (p2002Target(error).includes('userId')) {
          throw new CoachAlreadyActiveElsewhereException();
        }
        throw new DuplicateEmailException();
      }
      throw error;
    }

    if (isNewUser) {
      await this.emailService.send({
        to: coachUser.email,
        subject: 'Welcome!',
        body: `You've successfully joined as a coach.`,
      });
    }

    return this.tokenService.issuePair({
      id: coachUser.id,
      role: coachUser.role,
      parentUserId: null,
    });
  }

  private async loadExistingUser(userId: string): Promise<CoachUser> {
    return (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as CoachUser;
  }

  private assertMatchesTargetEmail(
    link: ActiveShareLink,
    acceptingEmail?: string,
  ): void {
    if (!link.targetEmail) {
      return;
    }
    if (
      !acceptingEmail ||
      acceptingEmail.toLowerCase() !== link.targetEmail.toLowerCase()
    ) {
      throw new AppException(
        'SHARELINK_EMAIL_MISMATCH',
        'This invite was addressed to a different email address',
        403,
      );
    }
  }
}

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, ShareLinkType } from '../../../generated/prisma/enums';
import { BCRYPT_COST_FACTOR } from '../../shared/config/bcrypt.constants';
import { AppException } from '../../shared/errors/app-exception';
import { assertNotChildAccount } from '../../shared/errors/assert-not-child-account.util';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DuplicateEmailException } from '../auth/exceptions/duplicate-email.exception';
import { TokenService } from '../auth/token.service';
import { JoinLinkInfoDto } from './dto/join-link-info.dto';
import { RegisterViaLinkDto } from './dto/register-via-link.dto';
import { ActiveShareLink, ShareLinkService } from './sharelink.service';
import { ShareLinkTypeMismatchException } from './exceptions/sharelink-type-mismatch.exception';

export interface RegisterViaLinkResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class PlayerRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
    private readonly shareLinkService: ShareLinkService,
  ) {}

  async resolveLink(
    code: string,
    currentUser?: AuthenticatedUser,
  ): Promise<JoinLinkInfoDto> {
    const link = await this.shareLinkService.getActiveLinkOrThrow(code);
    const trainerName = await this.getTrainerName(link.trainerId);

    const dto = new JoinLinkInfoDto();
    dto.trainerName = trainerName;
    dto.linkType = link.type;

    if (currentUser?.parentUserId) {
      await this.notifyParentOfChildLinkClick(currentUser, trainerName);
      dto.blocked = true;
      return dto;
    }

    if (currentUser) {
      const children = (await this.prisma.playerProfile.findMany({
        where: { parentUserId: currentUser.userId, isChild: true },
      })) as { id: string; displayName: string; birthDate: Date | null }[];

      if (children.length > 0) {
        dto.familySelectionNeeded = true;
        dto.familyMembers = children.map((child) => ({
          id: child.id,
          name: child.displayName,
          age: this.computeAge(child.birthDate),
        }));
      }
    }

    return dto;
  }

  async registerViaLink(
    code: string,
    dto: RegisterViaLinkDto,
    currentUser?: AuthenticatedUser,
  ): Promise<RegisterViaLinkResult> {
    const link = await this.shareLinkService.getActiveLinkOrThrow(code);
    if (link.type !== ShareLinkType.STATIC) {
      throw new ShareLinkTypeMismatchException();
    }

    // Defense in depth — resolveLink already blocks a child session from
    // ever reaching this point via the UI, but the endpoint itself must
    // not trust that.
    assertNotChildAccount(Boolean(currentUser?.parentUserId));

    const result = currentUser
      ? await this.associateExistingUser(currentUser, dto, link)
      : await this.registerNewUser(dto, link);

    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: { useCount: { increment: 1 } },
    });

    return result;
  }

  private async associateExistingUser(
    currentUser: AuthenticatedUser,
    dto: RegisterViaLinkDto,
    link: ActiveShareLink,
  ): Promise<RegisterViaLinkResult> {
    const memberIds = dto.associateMemberIds ?? ['self'];
    const targetProfileIds: string[] = [];

    if (memberIds.includes('self')) {
      const selfProfile = (await this.prisma.playerProfile.findFirst({
        where: { userId: currentUser.userId },
      })) as { id: string } | null;
      if (selfProfile) {
        targetProfileIds.push(selfProfile.id);
      }
    }

    for (const childId of memberIds.filter((id) => id !== 'self')) {
      // Ownership check — a spoofed id belonging to another family is
      // silently dropped, never associated.
      const child = (await this.prisma.playerProfile.findFirst({
        where: { id: childId, parentUserId: currentUser.userId },
      })) as { id: string } | null;
      if (child) {
        targetProfileIds.push(child.id);
      }
    }

    for (const playerProfileId of targetProfileIds) {
      const existingAssociation =
        (await this.prisma.trainerPlayerAssociation.findFirst({
          where: { trainerId: link.trainerId, playerProfileId },
        })) as { id: string } | null;
      if (!existingAssociation) {
        await this.prisma.trainerPlayerAssociation.create({
          data: {
            trainerId: link.trainerId,
            playerProfileId,
            shareLinkId: link.id,
          },
        });
      }
    }

    const user = (await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
    })) as { id: string; role: Role; parentUserId: string | null };
    return this.tokenService.issuePair(user);
  }

  private async registerNewUser(
    dto: RegisterViaLinkDto,
    link: ActiveShareLink,
  ): Promise<RegisterViaLinkResult> {
    const { email, password, firstName, lastName } = dto;
    if (!email || !password || !firstName || !lastName) {
      throw new AppException(
        'VALIDATION_ERROR',
        'email, password, firstName, and lastName are required to register',
        400,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new DuplicateEmailException();
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    const displayName = `${firstName} ${lastName}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = (await tx.user.create({
        data: {
          email,
          passwordHash,
          role: Role.PLAYER,
          // ShareLink registration is a deliberately frictionless flow (per
          // the product flow: "confirmation email sent... player logs in
          // immediately") — distinct from /auth/register's separate
          // verify-before-login gate.
          emailVerified: true,
          profile: {
            create: {
              firstName,
              lastName,
              phone: dto.phone,
            },
          },
        },
      })) as { id: string; email: string; role: Role };

      const playerProfile = (await tx.playerProfile.create({
        data: {
          userId: createdUser.id,
          parentUserId: createdUser.id,
          displayName,
          isChild: false,
        },
      })) as { id: string };

      await tx.trainerPlayerAssociation.create({
        data: {
          trainerId: link.trainerId,
          playerProfileId: playerProfile.id,
          shareLinkId: link.id,
        },
      });

      return createdUser;
    });

    await this.emailService.send({
      to: user.email,
      subject: 'Welcome!',
      body: `You've successfully joined via invite link.`,
    });

    return this.tokenService.issuePair({
      id: user.id,
      role: user.role,
      parentUserId: null,
    });
  }

  private async notifyParentOfChildLinkClick(
    childUser: AuthenticatedUser,
    trainerName: string,
  ): Promise<void> {
    if (!childUser.parentUserId) {
      return;
    }
    const [child, parent] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: childUser.userId },
        include: { profile: true },
      }) as Promise<{ profile: { firstName: string } | null } | null>,
      this.prisma.user.findUnique({
        where: { id: childUser.parentUserId },
      }) as Promise<{ email: string } | null>,
    ]);
    if (!parent) {
      return;
    }
    const childName = child?.profile?.firstName ?? 'Your child';
    await this.emailService.send({
      to: parent.email,
      subject: `${childName} wants to join ${trainerName}'s program`,
      body: `${childName} clicked an invite link for ${trainerName}. Log in to review and complete their registration.`,
    });
  }

  private async getTrainerName(trainerId: string): Promise<string> {
    const trainer = (await this.prisma.user.findUnique({
      where: { id: trainerId },
      include: { trainerProfile: true },
    })) as { trainerProfile: { businessName: string } | null } | null;
    return trainer?.trainerProfile?.businessName ?? 'Trainer';
  }

  private computeAge(birthDate: Date | null): number | undefined {
    if (!birthDate) {
      return undefined;
    }
    const diffMs = Date.now() - birthDate.getTime();
    return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  }
}

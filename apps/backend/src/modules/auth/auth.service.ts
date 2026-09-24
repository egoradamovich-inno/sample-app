import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Role, UserStatus } from '../../../generated/prisma/enums';
import { BCRYPT_COST_FACTOR } from '../../shared/config/bcrypt.constants';
import { EmailService } from '../../shared/email/email.service';
import { closeOpenImpersonationLog } from '../../shared/impersonation-log/close-open-impersonation-log.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccountDeactivatedException } from './exceptions/account-deactivated.exception';
import { DuplicateEmailException } from './exceptions/duplicate-email.exception';
import { EmailNotVerifiedException } from './exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { MeResponseDto } from './dto/me-response.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TokenPair, TokenService } from './token.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// Precomputed once per process and compared against on the unknown-email
// path so bcrypt.compare always runs — never short-circuited — regardless of
// whether the email is registered. Without this, an unknown email skips the
// ~200ms cost-12 compare entirely, and response latency alone (identical
// body notwithstanding) reveals whether an account exists. Lazily computed
// (not at module load) so importing this file never pays the hashing cost
// for callers that only need register()/logout().
let dummyPasswordHashPromise: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_COST_FACTOR,
  );
  return dummyPasswordHashPromise;
}

interface RegisteredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
}

interface AuthenticatableUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  parentUserId: string | null;
  lastLoginAt?: Date | null;
  profile?: { firstName: string; lastName: string } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new DuplicateEmailException();
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);
    const verificationToken = randomBytes(32).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = (await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: Role.PLAYER,
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
            },
          },
        },
      })) as RegisteredUser;

      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          token: verificationToken,
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });

      return createdUser;
    });

    await this.emailService.send({
      to: dto.email,
      subject: 'Verify your email',
      body: `Use this token to verify your email: ${verificationToken}`,
    });

    return user;
  }

  async login(
    dto: LoginDto,
  ): Promise<TokenPair & { user: AuthenticatableUser }> {
    const user = (await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    })) as AuthenticatableUser | null;

    // Credentials are checked before anything else, and unknown-email vs.
    // wrong-password both throw the identical InvalidCredentialsException —
    // no enumeration signal either way. bcrypt.compare always runs exactly
    // once here (against a dummy hash when the user doesn't exist) so an
    // unknown email pays the same ~200ms cost-12 compare as a known one —
    // response *timing* leaks no enumeration signal either, not just the body.
    const passwordHash = user
      ? user.passwordHash
      : await getDummyPasswordHash();
    const passwordMatches = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsException();
    }

    if (!user.emailVerified) {
      throw new EmailNotVerifiedException();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AccountDeactivatedException();
    }

    const tokens = await this.tokenService.issuePair(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { ...tokens, user };
  }

  /**
   * Returns `{ impersonatedBy }` (null for a normal session) so the
   * controller can clear the matching cookie pair only — impersonation_* for
   * an impersonated session, the regular pair otherwise — never both,
   * so ending an impersonated session's login never clears the admin's own
   * session cookies.
   */
  async logout(
    rawRefreshToken: string,
  ): Promise<{ impersonatedBy: string | null }> {
    // Checked ahead of revoke so a logout mid-impersonation never leaves the
    // ImpersonationLog row permanently open (a real gap this project has hit
    // before — a session ending without an explicit "Exit Impersonation").
    const active =
      await this.tokenService.findActiveByRawToken(rawRefreshToken);
    await this.tokenService.revoke(rawRefreshToken);

    if (active?.impersonatedBy) {
      await closeOpenImpersonationLog(
        this.prisma,
        active.impersonatedBy,
        active.userId,
      );
    }

    return { impersonatedBy: active?.impersonatedBy ?? null };
  }

  /**
   * Backs GET /auth/me. The JWT payload doesn't carry email, so this does
   * one cheap, field-only lookup (no joins) to fill it in.
   */
  async getMe(user: AuthenticatedUser): Promise<MeResponseDto> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    const dto = new MeResponseDto();
    dto.userId = user.userId;
    dto.email = dbUser?.email ?? '';
    dto.role = user.role;
    dto.parentUserId = user.parentUserId;
    dto.impersonatedBy = user.impersonatedBy;
    return dto;
  }
}

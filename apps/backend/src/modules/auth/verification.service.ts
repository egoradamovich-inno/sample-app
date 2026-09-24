import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { VerificationTokenExpiredException } from './exceptions/verification-token-expired.exception';
import { VerificationTokenInvalidException } from './exceptions/verification-token-invalid.exception';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new VerificationTokenInvalidException();
    }

    if (record.usedAt || record.expiresAt < new Date()) {
      // An already-used token is treated the same as an expired one — both
      // mean "this link can no longer redeem a verification", as opposed to
      // VerificationTokenInvalidException which is reserved for a token
      // that never existed at all.
      throw new VerificationTokenExpiredException();
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  /**
   * Always resolves the same way whether or not the email exists or is
   * already verified — no enumeration signal, same convention as
   * PasswordResetService.request. Only creates a token / sends an email for
   * a real, unverified account.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    await this.emailService.send({
      to: email,
      subject: 'Verify your email',
      body: `Use this token to verify your email: ${token}`,
    });
  }
}

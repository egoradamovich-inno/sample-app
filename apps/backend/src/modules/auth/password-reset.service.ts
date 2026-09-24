import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BCRYPT_COST_FACTOR } from '../../shared/config/bcrypt.constants';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PasswordResetTokenExpiredException } from './exceptions/password-reset-token-expired.exception';
import { PasswordResetTokenInvalidException } from './exceptions/password-reset-token-invalid.exception';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Always resolves the same way whether or not the email exists — no
   * enumeration signal. Only creates a token / sends an email for a real
   * account.
   */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = await this.createResetToken(user.id);

    await this.emailService.send({
      to: email,
      subject: 'Reset your password',
      body: `Use this token to reset your password: ${token}`,
    });
  }

  /**
   * Reusable by any flow that needs a "set/reset this user's password" link
   * — e.g. Task C1's admin-created-trainer invite-setup link, which is the
   * same underlying action (set a password via a one-time token) as a
   * self-service reset, just with a longer TTL and admin-initiated.
   */
  async createResetToken(
    userId: string,
    ttlMs: number = RESET_TOKEN_TTL_MS,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return token;
  }

  async confirm(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new PasswordResetTokenInvalidException();
    }

    if (record.usedAt || record.expiresAt < new Date()) {
      throw new PasswordResetTokenExpiredException();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { Role } from '../../../generated/prisma/enums';
import {
  JWT_ACCESS_EXPIRES_IN_SECONDS,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_EXPIRES_IN_MS,
} from '../../shared/config/jwt.constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';

export interface TokenSubjectUser {
  id: string;
  role: Role;
  parentUserId?: string | null;
}

export interface IssuePairOptions {
  impersonatedBy?: string;
  refreshTtlOverrideMs?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult extends TokenPair {
  /**
   * Set when the refreshed session originated from an impersonation login —
   * lets callers (AuthController) decide which cookie pair to set/clear
   * (impersonation_* vs. the regular session pair) from server-side truth,
   * regardless of which cookie/body field the raw token was read from.
   */
  impersonatedBy?: string;
}

@Injectable()
export class TokenService {
  private readonly jwtService = new JwtService({ secret: JWT_ACCESS_SECRET });

  constructor(private readonly prisma: PrismaService) {}

  async issuePair(
    user: TokenSubjectUser,
    opts?: IssuePairOptions,
  ): Promise<TokenPair> {
    const accessToken = this.signAccessToken(user, opts?.impersonatedBy);
    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const ttlMs = opts?.refreshTtlOverrideMs ?? JWT_REFRESH_EXPIRES_IN_MS;
    const expiresAt = new Date(Date.now() + ttlMs);
    const maxExpiresAt = opts?.refreshTtlOverrideMs ? expiresAt : null;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        impersonatedBy: opts?.impersonatedBy,
        maxExpiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async refresh(rawToken: string): Promise<RefreshResult> {
    const tokenHash = this.hashRefreshToken(rawToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false },
    });

    if (!record || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });
    if (!user) {
      throw new InvalidRefreshTokenException();
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    // A refresh token that came from an impersonation session never slides
    // past its original 1h-from-start cap, even across many refreshes.
    const slidTtlMs = record.maxExpiresAt
      ? Math.max(0, record.maxExpiresAt.getTime() - Date.now())
      : undefined;

    const impersonatedBy = record.impersonatedBy ?? undefined;
    const tokens = await this.issuePair(user, {
      impersonatedBy,
      refreshTtlOverrideMs: slidTtlMs,
    });

    return { ...tokens, impersonatedBy };
  }

  /**
   * Looks up an active refresh token's owning userId and (if any)
   * impersonatedBy admin id, without revoking it — used by AuthService.logout
   * to detect and close an in-progress impersonation session on logout,
   * ahead of the actual revoke.
   */
  async findActiveByRawToken(
    rawToken: string,
  ): Promise<{ userId: string; impersonatedBy: string | null } | null> {
    const tokenHash = this.hashRefreshToken(rawToken);
    const record = (await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false },
    })) as { userId: string; impersonatedBy: string | null } | null;
    return record
      ? { userId: record.userId, impersonatedBy: record.impersonatedBy }
      : null;
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  private signAccessToken(
    user: TokenSubjectUser,
    impersonatedBy?: string,
  ): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        role: user.role,
        parentUserId: user.parentUserId ?? null,
        ...(impersonatedBy ? { impersonatedBy } : {}),
      },
      { expiresIn: JWT_ACCESS_EXPIRES_IN_SECONDS },
    );
  }

  private hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

import { Injectable } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { closeOpenImpersonationLog } from '../../shared/impersonation-log/close-open-impersonation-log.util';
import { MappableUser, toUserSummary } from '../auth/user-summary.mapper';
import { TokenService } from '../auth/token.service';
import { CannotImpersonateSuperAdminException } from './exceptions/cannot-impersonate-super-admin.exception';
import { ImpersonationHistoryResponseDto } from './dto/impersonation-log-entry.dto';
import { ImpersonationStartResponseDto } from './dto/impersonation-start-response.dto';

const ONE_HOUR_MS = 60 * 60 * 1000;

interface ImpersonationLogRow {
  admin: {
    email: string;
    profile: { firstName: string; lastName: string } | null;
  };
  target: {
    email: string;
    profile: { firstName: string; lastName: string } | null;
  };
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

function displayName(user: {
  email: string;
  profile: { firstName: string; lastName: string } | null;
}): string {
  return user.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user.email;
}

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async start(
    adminId: string,
    targetUserId: string,
  ): Promise<ImpersonationStartResponseDto> {
    const target = (await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    })) as (MappableUser & { role: Role }) | null;

    if (!target) {
      throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new CannotImpersonateSuperAdminException();
    }

    const { accessToken, refreshToken } = await this.tokenService.issuePair(
      target,
      { impersonatedBy: adminId, refreshTtlOverrideMs: ONE_HOUR_MS },
    );

    const log = (await this.prisma.impersonationLog.create({
      data: { adminId, targetUserId },
    })) as { startedAt: Date };

    const dto = new ImpersonationStartResponseDto();
    dto.impersonatedUser = toUserSummary(target);
    dto.startedAt = log.startedAt.toISOString();
    dto.accessToken = accessToken;
    dto.refreshToken = refreshToken;
    return dto;
  }

  async exit(adminId: string, targetUserId: string): Promise<void> {
    await closeOpenImpersonationLog(this.prisma, adminId, targetUserId);
  }

  async history(query: {
    page: number;
    pageSize: number;
  }): Promise<ImpersonationHistoryResponseDto> {
    const [logs, total] = await Promise.all([
      this.prisma.impersonationLog.findMany({
        include: {
          admin: { include: { profile: true } },
          target: { include: { profile: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.impersonationLog.count(),
    ]);

    const dto = new ImpersonationHistoryResponseDto();
    dto.items = (logs as ImpersonationLogRow[]).map((log) => ({
      adminName: displayName(log.admin),
      targetName: displayName(log.target),
      startedAt: log.startedAt.toISOString(),
      endedAt: log.endedAt ? log.endedAt.toISOString() : null,
      durationSeconds: log.durationSeconds ?? null,
    }));
    dto.total = total;
    dto.page = query.page;
    dto.pageSize = query.pageSize;
    return dto;
  }
}

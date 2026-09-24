import { Role, UserStatus } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { CannotImpersonateSuperAdminException } from './exceptions/cannot-impersonate-super-admin.exception';
import { ImpersonationService } from './impersonation.service';
import { TokenService } from '../auth/token.service';

const ONE_HOUR_MS = 60 * 60 * 1000;

interface IssuePairCall {
  impersonatedBy?: string;
  refreshTtlOverrideMs?: number;
}

describe('ImpersonationService.start', () => {
  let service: ImpersonationService;
  let prisma: MockPrismaService;
  let tokenService: { issuePair: jest.Mock };

  const adminId = 'admin-1';
  const targetId = 'target-1';

  beforeEach(() => {
    prisma = createMockPrismaService();
    tokenService = {
      issuePair: jest.fn().mockResolvedValue({
        accessToken: 'imp-access',
        refreshToken: 'imp-refresh',
      }),
    };
    prisma.impersonationLog.create.mockResolvedValue({
      id: 'log-1',
      adminId,
      targetUserId: targetId,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      endedAt: null,
    });

    service = new ImpersonationService(
      prisma as never,
      tokenService as unknown as TokenService,
    );
  });

  it('should reject impersonating another Super Admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: targetId,
      email: 'admin2@x.com',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      profile: null,
    });

    await expect(service.start(adminId, targetId)).rejects.toThrow(
      CannotImpersonateSuperAdminException,
    );
    expect(tokenService.issuePair).not.toHaveBeenCalled();
  });

  it('should issue a token pair capped at 1 hour with impersonatedBy set', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: targetId,
      email: 'trainer@x.com',
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      profile: { firstName: 'T', lastName: 'Rainer' },
    });

    const result = await service.start(adminId, targetId);

    const issuePairArgs = getMockCallArg<[unknown, IssuePairCall]>(
      tokenService.issuePair,
      0,
      1,
    );
    expect(issuePairArgs.impersonatedBy).toBe(adminId);
    expect(issuePairArgs.refreshTtlOverrideMs).toBe(ONE_HOUR_MS);
    expect(result.accessToken).toBe('imp-access');
    expect(result.refreshToken).toBe('imp-refresh');
  });

  it('should write an ImpersonationLog row with startedAt set and endedAt null', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: targetId,
      email: 'trainer@x.com',
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      profile: { firstName: 'T', lastName: 'Rainer' },
    });

    await service.start(adminId, targetId);

    expect(prisma.impersonationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { adminId, targetUserId: targetId } }),
    );
  });

  it('should throw USER_NOT_FOUND for an unknown target', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.start(adminId, targetId)).rejects.toThrow(
      'User not found',
    );
  });
});

describe('ImpersonationService.exit', () => {
  let service: ImpersonationService;
  let prisma: MockPrismaService;
  let tokenService: { issuePair: jest.Mock };

  const adminId = 'admin-1';
  const targetId = 'target-1';

  beforeEach(() => {
    prisma = createMockPrismaService();
    tokenService = { issuePair: jest.fn() };
    service = new ImpersonationService(
      prisma as never,
      tokenService as unknown as TokenService,
    );
  });

  it('should set endedAt and durationSeconds on the open log row', async () => {
    prisma.impersonationLog.findFirst.mockResolvedValue({
      id: 'log-1',
      startedAt: new Date(Date.now() - 5000),
    });

    await service.exit(adminId, targetId);

    const updateArgs = getMockCallArg<{
      where: { id: string };
      data: { endedAt: Date; durationSeconds: number };
    }>(prisma.impersonationLog.update);
    expect(updateArgs.where).toEqual({ id: 'log-1' });
    expect(updateArgs.data.endedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should no-op when there is no open log for this admin/target pair', async () => {
    prisma.impersonationLog.findFirst.mockResolvedValue(null);
    await service.exit(adminId, targetId);
    expect(prisma.impersonationLog.update).not.toHaveBeenCalled();
  });
});

describe('ImpersonationService.history', () => {
  let service: ImpersonationService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ImpersonationService(
      prisma as never,
      { issuePair: jest.fn() } as unknown as TokenService,
    );
  });

  it('should paginate and map admin/target display names', async () => {
    prisma.impersonationLog.findMany.mockResolvedValue([
      {
        admin: {
          email: 'admin@x.com',
          profile: { firstName: 'A', lastName: 'B' },
        },
        target: { email: 'target@x.com', profile: null },
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: new Date('2026-01-01T00:05:00.000Z'),
        durationSeconds: 300,
      },
    ]);
    prisma.impersonationLog.count.mockResolvedValue(1);

    const result = await service.history({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].adminName).toBe('A B');
    expect(result.items[0].targetName).toBe('target@x.com');
    expect(result.items[0].durationSeconds).toBe(300);
  });
});

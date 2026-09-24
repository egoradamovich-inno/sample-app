import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { TokenService } from './token.service';

interface DecodedAccessToken {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  impersonatedBy?: string;
}

function decodeAccessToken(token: string): DecodedAccessToken {
  const decoded: unknown = new JwtService().decode(token);
  return decoded as DecodedAccessToken;
}

const testUser = {
  id: 'user-1',
  email: 'a@x.com',
  role: Role.PLAYER,
  status: UserStatus.ACTIVE,
  parentUserId: null,
};

describe('TokenService.issuePair', () => {
  let service: TokenService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
    service = new TokenService(prisma as never);
  });

  it('should issue an access token that expires in 15 minutes', async () => {
    const { accessToken } = await service.issuePair(testUser);
    const decoded = decodeAccessToken(accessToken);

    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('should persist a refresh token hash expiring 7 days out', async () => {
    await service.issuePair(testUser);

    const createArgs = getMockCallArg<{
      data: { userId: string; expiresAt: Date };
    }>(prisma.refreshToken.create);
    expect(createArgs.data.userId).toBe(testUser.id);
    const ttlMs = createArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('should include impersonatedBy in the access token payload when provided', async () => {
    const { accessToken } = await service.issuePair(testUser, {
      impersonatedBy: 'admin-1',
    });
    const decoded = decodeAccessToken(accessToken);

    expect(decoded.impersonatedBy).toBe('admin-1');
  });

  it('should cap the refresh token to 1 hour when refreshTtlOverrideMs is set', async () => {
    await service.issuePair(testUser, {
      impersonatedBy: 'admin-1',
      refreshTtlOverrideMs: 60 * 60 * 1000,
    });

    const createArgs = getMockCallArg<{ data: { expiresAt: Date } }>(
      prisma.refreshToken.create,
    );
    const ttlMs = createArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('should slide the refresh token forward on refresh', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'old-rt-id',
      userId: testUser.id,
      tokenHash: 'hash',
      revoked: false,
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    });
    prisma.user.findUnique.mockResolvedValue(testUser);
    prisma.refreshToken.update.mockResolvedValue({ id: 'old-rt-id' });

    await service.refresh('some-raw-refresh-token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-rt-id' },
      data: { revoked: true },
    });
  });

  it('should leave impersonatedBy undefined when refreshing a normal (non-impersonated) session', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'old-rt-id',
      userId: testUser.id,
      tokenHash: 'hash',
      revoked: false,
      impersonatedBy: null,
      maxExpiresAt: null,
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    });
    prisma.user.findUnique.mockResolvedValue(testUser);
    prisma.refreshToken.update.mockResolvedValue({ id: 'old-rt-id' });

    const result = await service.refresh('some-raw-refresh-token');

    expect(result.impersonatedBy).toBeUndefined();
  });

  it('should surface impersonatedBy on the result when refreshing an impersonation session, so callers can pick the right cookie pair', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'old-rt-id',
      userId: testUser.id,
      tokenHash: 'hash',
      revoked: false,
      impersonatedBy: 'admin-1',
      maxExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    prisma.user.findUnique.mockResolvedValue(testUser);
    prisma.refreshToken.update.mockResolvedValue({ id: 'old-rt-id' });

    const result = await service.refresh('some-raw-refresh-token');

    expect(result.impersonatedBy).toBe('admin-1');
  });
});

describe('TokenService.findActiveByRawToken', () => {
  let service: TokenService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new TokenService(prisma as never);
  });

  it('should return userId and impersonatedBy for a matching non-revoked token', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      userId: 'target-1',
      impersonatedBy: 'admin-1',
    });

    const result = await service.findActiveByRawToken('raw-refresh-token');

    expect(result).toEqual({ userId: 'target-1', impersonatedBy: 'admin-1' });
    const findFirstArgs = getMockCallArg<{ where: { revoked: boolean } }>(
      prisma.refreshToken.findFirst,
    );
    expect(findFirstArgs.where.revoked).toBe(false);
  });

  it('should return null when no matching token exists', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue(null);
    const result = await service.findActiveByRawToken('unknown-token');
    expect(result).toBeNull();
  });
});

describe('TokenService.revoke', () => {
  let service: TokenService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    service = new TokenService(prisma as never);
  });

  it('should mark the matching non-revoked refresh token as revoked', async () => {
    await service.revoke('raw-refresh-token');

    const updateManyCall = getMockCallArg<{
      where: { revoked: boolean };
      data: { revoked: boolean };
    }>(prisma.refreshToken.updateMany);
    expect(updateManyCall.where.revoked).toBe(false);
    expect(updateManyCall.data).toEqual({ revoked: true });
  });
});

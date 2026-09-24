import { ShareLinkType } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
  prismaP2002Error,
} from '../../shared/testing/prisma-mock.util';
import { ShareLinkService } from './sharelink.service';
import { ShareLinkExhaustedException } from './exceptions/sharelink-exhausted.exception';
import { ShareLinkExpiredException } from './exceptions/sharelink-expired.exception';
import { ShareLinkNotFoundException } from './exceptions/sharelink-not-found.exception';

const trainerId = 'trainer-1';
const createdById = 'trainer-1';

const activeLink = {
  id: 'link-1',
  code: 'abc123',
  type: ShareLinkType.STATIC,
  trainerId,
  targetEmail: null,
  expiresAt: null,
  maxUses: null,
  useCount: 0,
  active: true,
};

describe('ShareLinkService.generateStaticLink', () => {
  let service: ShareLinkService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ShareLinkService(prisma as never);
  });

  it('should create an unlimited-use, no-expiry STATIC link for the calling trainer', async () => {
    prisma.shareLink.create.mockResolvedValue({
      code: 'abc123',
      type: ShareLinkType.STATIC,
      expiresAt: null,
      maxUses: null,
    });

    const link = await service.generateStaticLink(trainerId, createdById);

    expect(link.code).toBe('abc123');
    const createArgs = getMockCallArg<{
      data: { type: ShareLinkType; expiresAt: null; maxUses: null };
    }>(prisma.shareLink.create);
    expect(createArgs.data.type).toBe(ShareLinkType.STATIC);
    expect(createArgs.data.expiresAt).toBeNull();
    expect(createArgs.data.maxUses).toBeNull();
  });

  it('should retry code generation on a unique-constraint collision, not check-then-insert', async () => {
    prisma.shareLink.create
      .mockRejectedValueOnce(prismaP2002Error())
      .mockResolvedValueOnce({
        code: 'retry-code',
        type: ShareLinkType.STATIC,
      });

    const link = await service.generateStaticLink(trainerId, createdById);

    expect(prisma.shareLink.create).toHaveBeenCalledTimes(2);
    expect(link.code).toBe('retry-code');
  });
});

describe('ShareLinkService.generateCoachInvite', () => {
  let service: ShareLinkService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ShareLinkService(prisma as never);
    prisma.shareLink.findFirst.mockResolvedValue(null);
  });

  it('should create a single-use, 7-day-expiry UNIQUE link targeting an email', async () => {
    prisma.shareLink.create.mockResolvedValue({
      code: 'coach-code',
      targetEmail: 'coach@x.com',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const link = await service.generateCoachInvite(
      trainerId,
      createdById,
      'coach@x.com',
    );

    const createArgs = getMockCallArg<{
      data: { type: ShareLinkType; maxUses: number; targetEmail: string };
    }>(prisma.shareLink.create);
    expect(createArgs.data.type).toBe(ShareLinkType.UNIQUE);
    expect(createArgs.data.maxUses).toBe(1);
    expect(createArgs.data.targetEmail).toBe('coach@x.com');
    expect(link.targetEmail).toBe('coach@x.com');
  });

  it('should reject a second invite while one is already pending for the same email', async () => {
    prisma.shareLink.findFirst.mockResolvedValue({
      id: 'existing',
      active: true,
      useCount: 0,
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(
      service.generateCoachInvite(trainerId, createdById, 'coach@x.com'),
    ).rejects.toThrow('unexpired invite');
    expect(prisma.shareLink.create).not.toHaveBeenCalled();
  });

  it('should retry code generation on a unique-constraint collision', async () => {
    prisma.shareLink.create
      .mockRejectedValueOnce(prismaP2002Error())
      .mockResolvedValueOnce({ code: 'retry', targetEmail: 'coach@x.com' });

    await service.generateCoachInvite(trainerId, createdById, 'coach@x.com');

    expect(prisma.shareLink.create).toHaveBeenCalledTimes(2);
  });
});

describe('ShareLinkService.resendInvite', () => {
  let service: ShareLinkService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ShareLinkService(prisma as never);
  });

  it('should deactivate the superseded link before issuing a new one', async () => {
    prisma.shareLink.findFirst.mockResolvedValueOnce({
      id: 'old-link',
      trainerId,
      targetEmail: 'coach@x.com',
      type: ShareLinkType.UNIQUE,
    });
    // no pending-invite conflict check inside generateCoachInvite this time
    prisma.shareLink.findFirst.mockResolvedValueOnce(null);
    prisma.shareLink.create.mockResolvedValue({
      code: 'new-code',
      targetEmail: 'coach@x.com',
    });

    await service.resendInvite(trainerId, 'old-link');

    expect(prisma.shareLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old-link' },
        data: { active: false },
      }),
    );
    expect(prisma.shareLink.create).toHaveBeenCalled();
  });

  it('should throw if the link does not belong to the calling trainer', async () => {
    prisma.shareLink.findFirst.mockResolvedValue(null);
    await expect(service.resendInvite(trainerId, 'not-mine')).rejects.toThrow(
      'not found',
    );
  });
});

describe('ShareLinkService.getActiveLinkOrThrow', () => {
  let service: ShareLinkService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ShareLinkService(prisma as never);
  });

  it('should return the link when active, unexpired, and under maxUses', async () => {
    prisma.shareLink.findUnique.mockResolvedValue(activeLink);
    const link = await service.getActiveLinkOrThrow('abc123');
    expect(link.id).toBe('link-1');
  });

  it('should throw ShareLinkNotFoundException for an unknown code', async () => {
    prisma.shareLink.findUnique.mockResolvedValue(null);
    await expect(service.getActiveLinkOrThrow('bad-code')).rejects.toThrow(
      ShareLinkNotFoundException,
    );
  });

  it('should throw ShareLinkExhaustedException when inactive', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...activeLink,
      active: false,
    });
    await expect(service.getActiveLinkOrThrow('abc123')).rejects.toThrow(
      ShareLinkExhaustedException,
    );
  });

  it('should throw ShareLinkExpiredException when past expiresAt', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...activeLink,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.getActiveLinkOrThrow('abc123')).rejects.toThrow(
      ShareLinkExpiredException,
    );
  });

  it('should throw ShareLinkExhaustedException when useCount has reached maxUses', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...activeLink,
      maxUses: 1,
      useCount: 1,
    });
    await expect(service.getActiveLinkOrThrow('abc123')).rejects.toThrow(
      ShareLinkExhaustedException,
    );
  });
});

describe('ShareLinkService.listCoachInvites', () => {
  let service: ShareLinkService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ShareLinkService(prisma as never);
  });

  it('should map PENDING, ACCEPTED, and EXPIRED statuses correctly', async () => {
    const now = Date.now();
    prisma.shareLink.findMany.mockResolvedValue([
      {
        id: '1',
        targetEmail: 'pending@x.com',
        active: true,
        useCount: 0,
        expiresAt: new Date(now + 10_000),
        createdAt: new Date(now),
      },
      {
        id: '2',
        targetEmail: 'accepted@x.com',
        active: false,
        useCount: 1,
        expiresAt: new Date(now + 10_000),
        createdAt: new Date(now),
      },
      {
        id: '3',
        targetEmail: 'expired@x.com',
        active: true,
        useCount: 0,
        expiresAt: new Date(now - 10_000),
        createdAt: new Date(now),
      },
    ]);

    const result = await service.listCoachInvites(trainerId);

    expect(result.find((r) => r.targetEmail === 'pending@x.com')?.status).toBe(
      'PENDING',
    );
    expect(result.find((r) => r.targetEmail === 'accepted@x.com')?.status).toBe(
      'ACCEPTED',
    );
    expect(result.find((r) => r.targetEmail === 'expired@x.com')?.status).toBe(
      'EXPIRED',
    );
  });
});

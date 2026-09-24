import { Role, ShareLinkType } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  MockPrismaService,
  prismaP2002Error,
} from '../../shared/testing/prisma-mock.util';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { EmailService } from '../../shared/email/email.service';
import { DuplicateEmailException } from '../auth/exceptions/duplicate-email.exception';
import { TokenService } from '../auth/token.service';
import { CoachInviteAcceptService } from './coach-invite-accept.service';
import { ShareLinkService } from './sharelink.service';
import { CoachAlreadyActiveElsewhereException } from './exceptions/coach-already-active-elsewhere.exception';
import { ShareLinkExhaustedException } from './exceptions/sharelink-exhausted.exception';
import { ShareLinkTypeMismatchException } from './exceptions/sharelink-type-mismatch.exception';

const uniqueLink = {
  id: 'link-1',
  code: 'coach-code',
  type: ShareLinkType.UNIQUE,
  trainerId: 'trainer-1',
  targetEmail: 'coach@x.com',
  // Comfortably far out — this object is computed once at module load and
  // reused (via spread) by every test in the file, so a short TTL here
  // (this used to be `Date.now() + 1000`) could intermittently "expire"
  // partway through a slower full-suite run and fail unrelated tests with
  // a misleading ShareLinkExpiredException.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  maxUses: 1,
  useCount: 0,
  active: true,
};

function makeAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 'coach-1',
    role: Role.COACH,
    parentUserId: null,
    ...overrides,
  };
}

describe('CoachInviteAcceptService.acceptInvite', () => {
  let service: CoachInviteAcceptService;
  let prisma: MockPrismaService;
  let tokenService: { issuePair: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    tokenService = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    };
    service = new CoachInviteAcceptService(
      prisma as never,
      {
        send: jest.fn().mockResolvedValue(undefined),
      } as unknown as EmailService,
      tokenService as unknown as TokenService,
      new ShareLinkService(prisma as never),
    );
    prisma.shareLink.findUnique.mockResolvedValue(uniqueLink);
    prisma.shareLink.updateMany.mockResolvedValue({ count: 1 });
  });

  it('should reject a STATIC link on the coach-only accept endpoint', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...uniqueLink,
      type: ShareLinkType.STATIC,
    });

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).rejects.toThrow(ShareLinkTypeMismatchException);
  });

  it('should create a new User + Profile + CoachProfile for a brand-new coach', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
    });
    prisma.coachProfile.findUnique.mockResolvedValue(null);

    const result = await service.acceptInvite('coach-code', {
      email: 'coach@x.com',
      password: 'Passw0rd!',
      firstName: 'C',
      lastName: 'Oach',
    });

    expect(prisma.coachProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'new-coach-1', trainerId: 'trainer-1' },
      }),
    );
    expect(result.accessToken).toBe('access');
  });

  it('should create a CoachProfile for an existing user with none yet', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
      parentUserId: null,
    });
    prisma.coachProfile.findUnique.mockResolvedValue(null);

    await service.acceptInvite('coach-code', {}, makeAuthUser());

    expect(prisma.coachProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'coach-1', trainerId: 'trainer-1' },
      }),
    );
  });

  it('should be idempotent when accepting under the same trainer twice', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
      parentUserId: null,
    });
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId: 'coach-1',
      trainerId: 'trainer-1',
    });

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).resolves.toBeDefined();
    expect(prisma.coachProfile.create).not.toHaveBeenCalled();
  });

  it('should reject when the coach is already active under a different trainer', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
      parentUserId: null,
    });
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId: 'coach-1',
      trainerId: 'some-other-trainer',
    });

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).rejects.toThrow(CoachAlreadyActiveElsewhereException);
    expect(prisma.coachProfile.create).not.toHaveBeenCalled();
  });

  it('should reject a second concurrent accept once the link has already been claimed', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
      parentUserId: null,
    });
    // Simulates losing the race: another transaction already flipped
    // active to false, so this guarded updateMany matches zero rows.
    prisma.shareLink.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).rejects.toThrow(ShareLinkExhaustedException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.coachProfile.create).not.toHaveBeenCalled();
  });

  it('should claim the link atomically before touching any user/coach data', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
    });
    prisma.coachProfile.findUnique.mockResolvedValue(null);

    await service.acceptInvite('coach-code', {
      email: 'coach@x.com',
      password: 'Passw0rd!',
      firstName: 'C',
      lastName: 'Oach',
    });

    expect(prisma.shareLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'link-1', active: true },
      data: { useCount: { increment: 1 }, active: false },
    });
  });

  it('should reject when the accepting email does not match the invite targetEmail', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.acceptInvite('coach-code', {
        email: 'someone-else@x.com',
        password: 'Passw0rd!',
        firstName: 'C',
        lastName: 'Oach',
      }),
    ).rejects.toThrow(/different email/);
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject when an authenticated user whose email differs from targetEmail accepts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'wrong@x.com',
      role: Role.COACH,
      parentUserId: null,
    });

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).rejects.toThrow(/different email/);
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
  });

  it('should allow acceptance when the invite has no targetEmail restriction', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...uniqueLink,
      targetEmail: null,
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-coach-1',
      email: 'anyone@x.com',
      role: Role.COACH,
    });
    prisma.coachProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.acceptInvite('coach-code', {
        email: 'anyone@x.com',
        password: 'Passw0rd!',
        firstName: 'C',
        lastName: 'Oach',
      }),
    ).resolves.toBeDefined();
  });

  it('should resolve a CoachProfile.userId P2002 collision (a concurrent accept won the single-trainer race first) to CoachAlreadyActiveElsewhereException, never a raw 500', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'coach-1',
      email: 'coach@x.com',
      role: Role.COACH,
      parentUserId: null,
    });
    // Both concurrent transactions' reads saw no existing CoachProfile;
    // this one loses at the final INSERT once the other has committed.
    prisma.coachProfile.findUnique.mockResolvedValue(null);
    prisma.coachProfile.create.mockRejectedValue(prismaP2002Error(['userId']));

    await expect(
      service.acceptInvite('coach-code', {}, makeAuthUser()),
    ).rejects.toThrow(CoachAlreadyActiveElsewhereException);
  });

  it('should resolve a User.email P2002 collision (two brand-new registrations racing the same email) to DuplicateEmailException, never a raw 500', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(prismaP2002Error(['email']));

    await expect(
      service.acceptInvite('coach-code', {
        email: 'coach@x.com',
        password: 'Passw0rd!',
        firstName: 'C',
        lastName: 'Oach',
      }),
    ).rejects.toThrow(DuplicateEmailException);
  });
});

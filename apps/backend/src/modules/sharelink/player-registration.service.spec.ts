import { Role, ShareLinkType } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { EmailService } from '../../shared/email/email.service';
import { TokenService } from '../auth/token.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PlayerRegistrationService } from './player-registration.service';
import { ShareLinkService } from './sharelink.service';
import { ShareLinkExpiredException } from './exceptions/sharelink-expired.exception';
import { ShareLinkNotFoundException } from './exceptions/sharelink-not-found.exception';
import { ShareLinkTypeMismatchException } from './exceptions/sharelink-type-mismatch.exception';

const staticLink = {
  id: 'link-1',
  code: 'abc123',
  type: ShareLinkType.STATIC,
  trainerId: 'trainer-1',
  targetEmail: null,
  expiresAt: null,
  maxUses: null,
  useCount: 0,
  active: true,
};

function makeAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 'parent-1',
    role: Role.PLAYER,
    parentUserId: null,
    ...overrides,
  };
}

describe('PlayerRegistrationService.resolveLink', () => {
  let service: PlayerRegistrationService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };
  let tokenService: { issuePair: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    tokenService = { issuePair: jest.fn() };
    service = new PlayerRegistrationService(
      prisma as never,
      emailService as unknown as EmailService,
      tokenService as unknown as TokenService,
      new ShareLinkService(prisma as never),
    );
    prisma.shareLink.findUnique.mockResolvedValue(staticLink);
    prisma.user.findUnique.mockResolvedValue({
      id: 'trainer-1',
      trainerProfile: { businessName: 'Acme Academy' },
    });
  });

  it('should throw ShareLinkNotFoundException for an unknown code', async () => {
    prisma.shareLink.findUnique.mockResolvedValue(null);
    await expect(service.resolveLink('bad-code')).rejects.toThrow(
      ShareLinkNotFoundException,
    );
  });

  it('should throw ShareLinkExpiredException for an expired code', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...staticLink,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.resolveLink('abc123')).rejects.toThrow(
      ShareLinkExpiredException,
    );
  });

  it('should return trainerName and linkType for an unauthenticated visitor', async () => {
    const result = await service.resolveLink('abc123');
    expect(result.trainerName).toBe('Acme Academy');
    expect(result.linkType).toBe(ShareLinkType.STATIC);
    expect(result.blocked).toBeUndefined();
  });

  it('should return blocked:true and notify the parent for a child session, without creating any association', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'trainer-1',
      trainerProfile: { businessName: 'Acme Academy' },
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'child-1',
      email: 'child@x.com',
      parentUserId: 'parent-1',
      profile: { firstName: 'Kid', lastName: 'X' },
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'parent-1',
      email: 'parent@x.com',
    });

    const childUser = makeAuthUser({
      userId: 'child-1',
      parentUserId: 'parent-1',
    });
    const result = await service.resolveLink('abc123', childUser);

    expect(result.blocked).toBe(true);
    expect(emailService.send).toHaveBeenCalled();
    expect(prisma.trainerPlayerAssociation.create).not.toHaveBeenCalled();
  });

  it('should signal familySelectionNeeded with familyMembers for a parent with children', async () => {
    prisma.playerProfile.findMany.mockResolvedValue([
      { id: 'child-1', displayName: 'Alex', birthDate: null },
    ]);

    const parentUser = makeAuthUser({ userId: 'parent-1', parentUserId: null });
    const result = await service.resolveLink('abc123', parentUser);

    expect(result.familySelectionNeeded).toBe(true);
    expect(result.familyMembers).toEqual([
      expect.objectContaining({ id: 'child-1', name: 'Alex' }),
    ]);
  });
});

describe('PlayerRegistrationService.registerViaLink (new user)', () => {
  let service: PlayerRegistrationService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };
  let tokenService: { issuePair: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    tokenService = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    };
    service = new PlayerRegistrationService(
      prisma as never,
      emailService as unknown as EmailService,
      tokenService as unknown as TokenService,
      new ShareLinkService(prisma as never),
    );
    prisma.shareLink.findUnique.mockResolvedValue(staticLink);
    prisma.user.findUnique.mockResolvedValue(null); // no existing account for the email
    prisma.user.create.mockResolvedValue({
      id: 'new-user-1',
      email: 'new@x.com',
      role: Role.PLAYER,
    });
    prisma.playerProfile.create.mockResolvedValue({ id: 'pp-1' });
  });

  it('should create User + Profile + PlayerProfile + association in one transaction', async () => {
    const result = await service.registerViaLink('abc123', {
      email: 'new@x.com',
      password: 'Passw0rd!',
      firstName: 'New',
      lastName: 'User',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.playerProfile.create).toHaveBeenCalled();
    const assocArgs = getMockCallArg<{
      data: { trainerId: string; shareLinkId: string };
    }>(prisma.trainerPlayerAssociation.create);
    expect(assocArgs.data.trainerId).toBe('trainer-1');
    expect(assocArgs.data.shareLinkId).toBe('link-1');
    expect(result.accessToken).toBe('access');
  });

  it('should reject a STATIC-only endpoint hit with a UNIQUE (coach) link', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      ...staticLink,
      type: ShareLinkType.UNIQUE,
    });

    await expect(
      service.registerViaLink('abc123', {
        email: 'new@x.com',
        password: 'Passw0rd!',
        firstName: 'New',
        lastName: 'User',
      }),
    ).rejects.toThrow(ShareLinkTypeMismatchException);
  });
});

describe('PlayerRegistrationService.registerViaLink (existing user, family selection)', () => {
  let service: PlayerRegistrationService;
  let prisma: MockPrismaService;
  let tokenService: { issuePair: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    tokenService = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    };
    service = new PlayerRegistrationService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
      new ShareLinkService(prisma as never),
    );
    prisma.shareLink.findUnique.mockResolvedValue(staticLink);
    prisma.playerProfile.findFirst.mockResolvedValue({
      id: 'self-pp-1',
      userId: 'parent-1',
    });
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'parent-1',
      role: Role.PLAYER,
      parentUserId: null,
    });
  });

  it('should associate only the explicitly selected members, creating no duplicate account', async () => {
    const parentUser = makeAuthUser({ userId: 'parent-1' });

    await service.registerViaLink(
      'abc123',
      { associateMemberIds: ['self'] },
      parentUser,
    );

    expect(prisma.user.create).not.toHaveBeenCalled();
    const assocArgs = getMockCallArg<{ data: { playerProfileId: string } }>(
      prisma.trainerPlayerAssociation.create,
    );
    expect(assocArgs.data.playerProfileId).toBe('self-pp-1');
  });

  it('should not associate a child id that does not belong to the calling parent', async () => {
    prisma.playerProfile.findFirst
      .mockResolvedValueOnce({ id: 'self-pp-1', userId: 'parent-1' }) // 'self' lookup
      .mockResolvedValueOnce(null); // spoofed child id, ownership check fails

    const parentUser = makeAuthUser({ userId: 'parent-1' });
    await service.registerViaLink(
      'abc123',
      { associateMemberIds: ['self', 'not-my-child'] },
      parentUser,
    );

    expect(prisma.trainerPlayerAssociation.create).toHaveBeenCalledTimes(1);
  });
});

import { Role, UserStatus } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
  prismaP2025Error,
} from '../../shared/testing/prisma-mock.util';
import { ProfileService } from './profile.service';

interface MockStorageService {
  savePhoto: jest.Mock;
  saveLogo: jest.Mock;
  delete: jest.Mock;
}

const baseUser = {
  id: 'u1',
  email: 'trainer@x.com',
  role: Role.TRAINER,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  profile: {
    firstName: 'A',
    lastName: 'B',
    phone: null,
    photoUrl: null,
    school: null,
  },
  trainerProfile: {
    businessName: 'Acme',
    address: null,
    website: null,
    description: null,
  },
  coachProfile: null,
  playerProfile: null,
};

describe('ProfileService.getOwnProfile', () => {
  let service: ProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ProfileService(prisma as never, {
      savePhoto: jest.fn(),
      saveLogo: jest.fn(),
      delete: jest.fn(),
    });
  });

  it('should merge User + Profile + TrainerProfile fields for a trainer', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await service.getOwnProfile('u1');

    expect(result.email).toBe('trainer@x.com');
    expect(result.role).toBe(Role.TRAINER);
    expect(result.firstName).toBe('A');
    expect(result.businessName).toBe('Acme');
  });

  it('should include CoachProfile fields for a coach', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      role: Role.COACH,
      trainerProfile: null,
      coachProfile: {
        bio: 'Great coach',
        credentials: 'USSF A',
        certifications: ['CPR'],
        publicVisible: true,
      },
    });

    const result = await service.getOwnProfile('u1');

    expect(result.bio).toBe('Great coach');
    expect(result.certifications).toEqual(['CPR']);
    expect(result.publicVisible).toBe(true);
  });

  it('should include PlayerProfile fields for a player', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      role: Role.PLAYER,
      trainerProfile: null,
      playerProfile: {
        skillLevel: 'Intermediate',
        jerseyNumber: '9',
        emergencyContact: '555-1234',
      },
    });

    const result = await service.getOwnProfile('u1');

    expect(result.skillLevel).toBe('Intermediate');
    expect(result.jerseyNumber).toBe('9');
    expect(result.emergencyContact).toBe('555-1234');
  });
});

describe('ProfileService.updateOwnProfile', () => {
  let service: ProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ProfileService(prisma as never, {
      savePhoto: jest.fn(),
      saveLogo: jest.fn(),
      delete: jest.fn(),
    });
    prisma.user.findUnique.mockResolvedValue(baseUser);
  });

  it('should update common Profile fields', async () => {
    await service.updateOwnProfile('u1', Role.TRAINER, {
      firstName: 'New',
      phone: '555-0000',
    });

    const updateArgs = getMockCallArg<{
      where: { userId: string };
      data: { firstName?: string; phone?: string };
    }>(prisma.profile.update);
    expect(updateArgs.where).toEqual({ userId: 'u1' });
    expect(updateArgs.data.firstName).toBe('New');
    expect(updateArgs.data.phone).toBe('555-0000');
  });

  it('should update TrainerProfile fields only for a TRAINER caller', async () => {
    await service.updateOwnProfile('u1', Role.TRAINER, {
      businessName: 'New Biz',
    });

    expect(prisma.trainerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { businessName: 'New Biz' },
      }),
    );
  });

  it('should not touch TrainerProfile for a PLAYER caller even if businessName is (illegally) present', async () => {
    await service.updateOwnProfile('u1', Role.PLAYER, {
      businessName: 'Should be ignored',
    });

    expect(prisma.trainerProfile.update).not.toHaveBeenCalled();
  });

  it('should update CoachProfile fields for a COACH caller', async () => {
    await service.updateOwnProfile('u1', Role.COACH, {
      bio: 'New bio',
      publicVisible: true,
    });

    expect(prisma.coachProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { bio: 'New bio', publicVisible: true },
      }),
    );
  });

  it('should update PlayerProfile fields for a PLAYER caller', async () => {
    await service.updateOwnProfile('u1', Role.PLAYER, {
      jerseyNumber: '23',
      emergencyContact: '555-9999',
    });

    expect(prisma.playerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { jerseyNumber: '23', emergencyContact: '555-9999' },
      }),
    );
  });

  it('should throw a PROFILE_NOT_PROVISIONED 404 when the Profile row does not exist', async () => {
    prisma.profile.update.mockRejectedValue(prismaP2025Error());

    await expect(
      service.updateOwnProfile('u1', Role.TRAINER, { firstName: 'New' }),
    ).rejects.toMatchObject({
      errorCode: 'PROFILE_NOT_PROVISIONED',
      status: 404,
    });
  });

  it('should throw a TRAINER_PROFILE_NOT_PROVISIONED 404 when the TrainerProfile row does not exist', async () => {
    prisma.trainerProfile.update.mockRejectedValue(prismaP2025Error());

    await expect(
      service.updateOwnProfile('u1', Role.TRAINER, {
        businessName: 'New Biz',
      }),
    ).rejects.toMatchObject({
      errorCode: 'TRAINER_PROFILE_NOT_PROVISIONED',
      status: 404,
    });
  });

  it('should throw a COACH_PROFILE_NOT_PROVISIONED 404 when the CoachProfile row does not exist', async () => {
    prisma.coachProfile.update.mockRejectedValue(prismaP2025Error());

    await expect(
      service.updateOwnProfile('u1', Role.COACH, { bio: 'New bio' }),
    ).rejects.toMatchObject({
      errorCode: 'COACH_PROFILE_NOT_PROVISIONED',
      status: 404,
    });
  });

  it('should throw a PLAYER_PROFILE_NOT_PROVISIONED 404 when the PlayerProfile row does not exist', async () => {
    prisma.playerProfile.update.mockRejectedValue(prismaP2025Error());

    await expect(
      service.updateOwnProfile('u1', Role.PLAYER, { jerseyNumber: '23' }),
    ).rejects.toMatchObject({
      errorCode: 'PLAYER_PROFILE_NOT_PROVISIONED',
      status: 404,
    });
  });

  it('should be an AppException instance carrying the errorCode when a sub-profile row is missing', async () => {
    prisma.trainerProfile.update.mockRejectedValue(prismaP2025Error());

    await expect(
      service.updateOwnProfile('u1', Role.TRAINER, {
        businessName: 'New Biz',
      }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('should propagate a non-P2025 error unchanged instead of masking it', async () => {
    const unrelatedError = new Error('connection lost');
    prisma.profile.update.mockRejectedValue(unrelatedError);

    await expect(
      service.updateOwnProfile('u1', Role.TRAINER, { firstName: 'New' }),
    ).rejects.toBe(unrelatedError);
  });

  it('should still return 200-equivalent updated data when every targeted row exists (happy path)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      profile: { ...baseUser.profile, firstName: 'New' },
      trainerProfile: { ...baseUser.trainerProfile, businessName: 'New Biz' },
    });

    const result = await service.updateOwnProfile('u1', Role.TRAINER, {
      firstName: 'New',
      businessName: 'New Biz',
    });

    expect(prisma.profile.update).toHaveBeenCalled();
    expect(prisma.trainerProfile.update).toHaveBeenCalled();
    expect(result.firstName).toBe('New');
    expect(result.businessName).toBe('New Biz');
  });
});

describe('ProfileService.uploadPhoto', () => {
  let service: ProfileService;
  let prisma: MockPrismaService;
  let storageService: MockStorageService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    storageService = {
      savePhoto: jest.fn().mockResolvedValue({
        url: '/uploads/photos/new.png',
        thumbnailUrl: '/x',
      }),
      saveLogo: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProfileService(prisma as never, storageService);
    prisma.user.findUnique.mockResolvedValue(baseUser);
  });

  it('should save the new photo and update Profile.photoUrl', async () => {
    prisma.profile.findUnique.mockResolvedValue({ photoUrl: null });
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      profile: { ...baseUser.profile, photoUrl: '/uploads/photos/new.png' },
    });

    const result = await service.uploadPhoto('u1', Buffer.from('fake'));

    expect(storageService.savePhoto).toHaveBeenCalledWith(
      Buffer.from('fake'),
      'u1',
    );
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { photoUrl: '/uploads/photos/new.png' },
      }),
    );
    expect(result.photoUrl).toBe('/uploads/photos/new.png');
  });

  it('should delete the old photo file when replacing an existing one', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      photoUrl: '/uploads/photos/old.png',
    });

    await service.uploadPhoto('u1', Buffer.from('fake'));

    expect(storageService.delete).toHaveBeenCalledWith(
      '/uploads/photos/old.png',
    );
  });
});

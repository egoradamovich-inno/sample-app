import { Role } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BrandingService } from './branding.service';

function makeUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 'user-1',
    role: Role.PLAYER,
    parentUserId: null,
    ...overrides,
  };
}

const trainerId = 'trainer-1';

describe('BrandingService.getBranding', () => {
  let service: BrandingService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new BrandingService(prisma as never, {
      savePhoto: jest.fn(),
      saveLogo: jest.fn(),
      delete: jest.fn(),
    });
  });

  it('should return logoUrl and primaryColorHex for the resolved trainer', async () => {
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: {
        logoUrl: '/uploads/branding/x.png',
        primaryColorHex: '#E2621B',
      },
    });

    const result = await service.getBranding(trainerId);
    expect(result.logoUrl).toBe('/uploads/branding/x.png');
    expect(result.primaryColorHex).toBe('#E2621B');
  });

  it('should return nulls when no branding has been set yet', async () => {
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: null,
    });
    const result = await service.getBranding(trainerId);
    expect(result.logoUrl).toBeNull();
    expect(result.primaryColorHex).toBeNull();
  });

  it('should 404 for an unknown trainer', async () => {
    prisma.trainerProfile.findUnique.mockResolvedValue(null);
    await expect(service.getBranding(trainerId)).rejects.toThrow();
  });
});

describe('BrandingService.updateBranding', () => {
  let service: BrandingService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new BrandingService(prisma as never, {
      savePhoto: jest.fn(),
      saveLogo: jest.fn(),
      delete: jest.fn(),
    });
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: null,
    });
    prisma.branding.upsert.mockResolvedValue({
      logoUrl: null,
      primaryColorHex: '#123456',
    });
  });

  it('should upsert the primary color keyed by trainerProfileId', async () => {
    await service.updateBranding(trainerId, { primaryColorHex: '#123456' });

    const upsertArgs = getMockCallArg<{ where: { trainerProfileId: string } }>(
      prisma.branding.upsert,
    );
    expect(upsertArgs.where.trainerProfileId).toBe('tp-1');
  });
});

describe('BrandingService.resolveTrainerIdForCaller', () => {
  let service: BrandingService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new BrandingService(prisma as never, {
      savePhoto: jest.fn(),
      saveLogo: jest.fn(),
      delete: jest.fn(),
    });
  });

  it('should use the explicit trainerId when given', async () => {
    const result = await service.resolveTrainerIdForCaller(
      makeUser({ role: Role.PLAYER }),
      'explicit-trainer',
    );
    expect(result).toBe('explicit-trainer');
  });

  it("should resolve a TRAINER caller's own userId", async () => {
    const result = await service.resolveTrainerIdForCaller(
      makeUser({ userId: 'trainer-1', role: Role.TRAINER }),
    );
    expect(result).toBe('trainer-1');
  });

  it("should resolve a COACH caller's own CoachProfile.trainerId", async () => {
    prisma.coachProfile.findFirst.mockResolvedValue({ trainerId: 'trainer-2' });
    const result = await service.resolveTrainerIdForCaller(
      makeUser({ role: Role.COACH }),
    );
    expect(result).toBe('trainer-2');
  });

  it('should require an explicit trainerId for a PLAYER caller', async () => {
    await expect(
      service.resolveTrainerIdForCaller(makeUser({ role: Role.PLAYER })),
    ).rejects.toThrow();
  });
});

describe('BrandingService.uploadLogo', () => {
  let service: BrandingService;
  let prisma: MockPrismaService;
  let storageService: {
    savePhoto: jest.Mock;
    saveLogo: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    storageService = {
      savePhoto: jest.fn(),
      saveLogo: jest
        .fn()
        .mockResolvedValue({ url: '/uploads/branding/new.png' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new BrandingService(prisma as never, storageService);
    prisma.branding.upsert.mockResolvedValue({
      logoUrl: '/uploads/branding/new.png',
      primaryColorHex: null,
    });
  });

  it('should save the new logo and delete the old one when replacing', async () => {
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: { logoUrl: '/uploads/branding/old.png' },
    });

    await service.uploadLogo(trainerId, Buffer.from('fake'));

    expect(storageService.saveLogo).toHaveBeenCalledWith(
      Buffer.from('fake'),
      trainerId,
    );
    expect(storageService.delete).toHaveBeenCalledWith(
      '/uploads/branding/old.png',
    );
  });

  it('should not attempt to delete when there was no prior logo', async () => {
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: null,
    });

    await service.uploadLogo(trainerId, Buffer.from('fake'));

    expect(storageService.delete).not.toHaveBeenCalled();
  });

  it('delegates resize/size decisions to the storage layer, passing the raw buffer through unchanged', async () => {
    // Size-cap enforcement lives in the controller's FileInterceptor limits
    // and resize-to-200x200 lives in LocalDiskStorage.saveLogo — the service
    // must not duplicate either concern, just hand the buffer off.
    prisma.trainerProfile.findUnique.mockResolvedValue({
      id: 'tp-1',
      branding: null,
    });
    const oversizedLikeBuffer = Buffer.alloc(1024, 1);

    await service.uploadLogo(trainerId, oversizedLikeBuffer);

    expect(storageService.saveLogo).toHaveBeenCalledWith(
      oversizedLikeBuffer,
      trainerId,
    );
  });
});

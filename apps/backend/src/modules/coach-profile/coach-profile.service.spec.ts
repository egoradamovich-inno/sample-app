import { UserStatus } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
  prismaP2002Error,
} from '../../shared/testing/prisma-mock.util';
import { CoachProfileService } from './coach-profile.service';

const userId = 'coach-1';

describe('CoachProfileService.updateProfile', () => {
  let service: CoachProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CoachProfileService(prisma as never);
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      profile: { firstName: 'Jane', lastName: 'Doe' },
    });
  });

  it('should update bio/credentials/certifications without touching publicSlug when publicVisible stays false', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId,
      publicVisible: false,
      publicSlug: null,
    });
    prisma.coachProfile.update.mockResolvedValue({
      bio: 'New bio',
      credentials: null,
      certifications: [],
      publicVisible: false,
      publicSlug: null,
    });

    await service.updateProfile(userId, { bio: 'New bio' });

    expect(prisma.coachProfile.create).not.toHaveBeenCalled();
    const updateArgs = getMockCallArg<{ data: { publicSlug?: string } }>(
      prisma.coachProfile.update,
    );
    expect(updateArgs.data.publicSlug).toBeUndefined();
  });

  it('should lazily generate a publicSlug on first publicVisible=true', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId,
      publicVisible: false,
      publicSlug: null,
    });
    prisma.coachProfile.update.mockResolvedValue({
      bio: null,
      credentials: null,
      certifications: [],
      publicVisible: true,
      publicSlug: 'jane-doe',
    });

    const result = await service.updateProfile(userId, { publicVisible: true });

    const updateArgs = getMockCallArg<{ data: { publicSlug?: string } }>(
      prisma.coachProfile.update,
    );
    expect(updateArgs.data.publicSlug).toBeDefined();
    expect(result.publicSlug).toBe('jane-doe');
  });

  it('should retry slug generation on a unique-constraint collision', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId,
      publicVisible: false,
      publicSlug: null,
    });
    prisma.coachProfile.update
      .mockRejectedValueOnce(prismaP2002Error())
      .mockResolvedValueOnce({
        bio: null,
        credentials: null,
        certifications: [],
        publicVisible: true,
        publicSlug: 'jane-doe-2',
      });

    await service.updateProfile(userId, { publicVisible: true });

    expect(prisma.coachProfile.update).toHaveBeenCalledTimes(2);
  });

  it('should not regenerate a slug that already exists', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      userId,
      publicVisible: true,
      publicSlug: 'jane-doe',
    });
    prisma.coachProfile.update.mockResolvedValue({
      bio: 'Updated',
      credentials: null,
      certifications: [],
      publicVisible: true,
      publicSlug: 'jane-doe',
    });

    await service.updateProfile(userId, { bio: 'Updated' });

    const updateArgs = getMockCallArg<{ data: { publicSlug?: string } }>(
      prisma.coachProfile.update,
    );
    expect(updateArgs.data.publicSlug).toBeUndefined();
  });
});

describe('CoachProfileService.getPublicProfile', () => {
  let service: CoachProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CoachProfileService(prisma as never);
  });

  it('should return the profile for a public, active coach', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      bio: 'Great coach',
      credentials: 'USSF A',
      certifications: ['CPR'],
      publicVisible: true,
      user: {
        status: UserStatus.ACTIVE,
        profile: { firstName: 'Jane', lastName: 'Doe' },
      },
    });

    const result = await service.getPublicProfile('jane-doe');
    expect(result.name).toBe('Jane Doe');
  });

  it('should 404 uniformly for an unknown slug', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue(null);
    await expect(service.getPublicProfile('unknown')).rejects.toThrow();
  });

  it('should 404 uniformly when the profile exists but is not public', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      publicVisible: false,
      user: {
        status: UserStatus.ACTIVE,
        profile: { firstName: 'J', lastName: 'D' },
      },
    });
    await expect(service.getPublicProfile('jane-doe')).rejects.toThrow();
  });

  it('should 404 uniformly when the underlying user is deactivated/deleted', async () => {
    prisma.coachProfile.findUnique.mockResolvedValue({
      publicVisible: true,
      user: {
        status: UserStatus.INACTIVE,
        profile: { firstName: 'J', lastName: 'D' },
      },
    });
    await expect(service.getPublicProfile('jane-doe')).rejects.toThrow();
  });
});

import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { PlayerProfileService } from './player-profile.service';

const parentUserId = 'parent-1';

function daysAgoYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

describe('PlayerProfileService.createChildProfile', () => {
  let service: PlayerProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new PlayerProfileService(prisma as never);
    prisma.playerProfile.findMany.mockResolvedValue([]);
    prisma.playerProfile.create.mockResolvedValue({
      id: 'child-1',
      displayName: 'Alex',
      birthDate: new Date(daysAgoYears(10)),
      isChild: true,
    });
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([]);
  });

  it('should reject an age outside 1-18', async () => {
    await expect(
      service.createChildProfile(
        parentUserId,
        {
          displayName: 'Too Old',
          birthDate: daysAgoYears(20),
          gender: 'other',
        },
        false,
      ),
    ).rejects.toThrow('1 and 18');
    expect(prisma.playerProfile.create).not.toHaveBeenCalled();
  });

  it('should create the child profile as isChild=true under the parent', async () => {
    await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
      },
      false,
    );

    const createArgs = getMockCallArg<{
      data: { parentUserId: string; isChild: boolean; displayName: string };
    }>(prisma.playerProfile.create);
    expect(createArgs.data.parentUserId).toBe(parentUserId);
    expect(createArgs.data.isChild).toBe(true);
    expect(createArgs.data.displayName).toBe('Alex');
  });

  it('should set duplicateWarning when a same-name/age sibling already exists', async () => {
    prisma.playerProfile.findMany.mockResolvedValue([
      {
        id: 'existing',
        displayName: 'alex',
        birthDate: new Date(daysAgoYears(10)),
        isChild: true,
      },
    ]);

    const result = await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
      },
      false,
    );

    expect(result.duplicateWarning).toBe(true);
  });

  it('should leave the child trainer-less and signal trainerSelectionPrompt=null when the family has no trainers', async () => {
    const result = await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
      },
      false,
    );

    expect(prisma.trainerPlayerAssociation.create).not.toHaveBeenCalled();
    expect(result.trainerSelectionPrompt).toBeNull();
  });

  it('should signal trainerSelectionPrompt="single" when the family has exactly one trainer', async () => {
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([
      { trainerId: 'trainer-1', playerProfileId: 'self-pp' },
    ]);

    const result = await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
      },
      false,
    );

    expect(result.trainerSelectionPrompt).toBe('single');
  });

  it('should signal trainerSelectionPrompt="multi" when the family has 2+ distinct trainers', async () => {
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([
      { trainerId: 'trainer-1', playerProfileId: 'self-pp' },
      { trainerId: 'trainer-2', playerProfileId: 'other-child-pp' },
    ]);

    const result = await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
      },
      false,
    );

    expect(result.trainerSelectionPrompt).toBe('multi');
  });

  it('should immediately associate explicitly selected trainers and skip the prompt', async () => {
    await service.createChildProfile(
      parentUserId,
      {
        displayName: 'Alex',
        birthDate: daysAgoYears(10),
        gender: 'male',
        associateTrainerIds: ['trainer-1'],
      },
      false,
    );

    const assocArgs = getMockCallArg<{
      data: { trainerId: string; playerProfileId: string };
    }>(prisma.trainerPlayerAssociation.create);
    expect(assocArgs.data.trainerId).toBe('trainer-1');
    expect(assocArgs.data.playerProfileId).toBe('child-1');
  });

  it('should reject when the caller is a child account', async () => {
    await expect(
      service.createChildProfile(
        parentUserId,
        {
          displayName: 'Alex',
          birthDate: daysAgoYears(10),
          gender: 'male',
        },
        true,
      ),
    ).rejects.toThrow('not available to a child account');
    expect(prisma.playerProfile.create).not.toHaveBeenCalled();
  });
});

describe('PlayerProfileService.listOwnFamily', () => {
  let service: PlayerProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new PlayerProfileService(prisma as never);
  });

  it('should include self and children, each with their trainer associations', async () => {
    prisma.playerProfile.findMany.mockResolvedValue([
      {
        id: 'self-pp',
        displayName: 'Parent',
        birthDate: null,
        isChild: false,
        userId: parentUserId,
      },
      {
        id: 'child-pp',
        displayName: 'Alex',
        birthDate: new Date(daysAgoYears(10)),
        isChild: true,
        userId: null,
      },
    ]);
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([
      { trainerId: 'trainer-1', playerProfileId: 'self-pp', status: 'ACTIVE' },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'trainer-1', trainerProfile: { businessName: 'Acme' } },
    ]);

    const result = await service.listOwnFamily(parentUserId);

    expect(result).toHaveLength(2);
    const self = result.find((p) => p.id === 'self-pp');
    expect(self?.trainerAssociations[0].trainerName).toBe('Acme');
    const child = result.find((p) => p.id === 'child-pp');
    expect(child?.trainerAssociations).toEqual([]);
  });
});

describe('PlayerProfileService.ensureSelfProfile', () => {
  let service: PlayerProfileService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new PlayerProfileService(prisma as never);
  });

  it('creates a non-child self profile when none exists yet', async () => {
    prisma.playerProfile.findUnique.mockResolvedValue(null);
    prisma.playerProfile.create.mockResolvedValue({ id: 'new-pp' });

    const result = await service.ensureSelfProfile('user-1', 'Jamie Parent');

    expect(result).toEqual({ id: 'new-pp' });
    const createArgs = getMockCallArg<{
      data: {
        userId: string;
        parentUserId: string;
        displayName: string;
        isChild: boolean;
      };
    }>(prisma.playerProfile.create);
    expect(createArgs.data).toEqual({
      userId: 'user-1',
      parentUserId: 'user-1',
      displayName: 'Jamie Parent',
      isChild: false,
    });
  });

  it('returns the existing self profile instead of creating a duplicate', async () => {
    prisma.playerProfile.findUnique.mockResolvedValue({ id: 'existing-pp' });

    const result = await service.ensureSelfProfile('user-1', 'Jamie Parent');

    expect(result).toEqual({ id: 'existing-pp' });
    expect(prisma.playerProfile.create).not.toHaveBeenCalled();
  });
});

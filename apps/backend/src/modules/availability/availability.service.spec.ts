import { Role } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AvailabilityService } from './availability.service';

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

describe('AvailabilityService.setMine (player)', () => {
  let service: AvailabilityService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new AvailabilityService(prisma as never);
    prisma.playerProfile.findFirst.mockResolvedValue({ id: 'self-pp-1' });
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.availability.findMany.mockResolvedValue([]);
  });

  it('should replace the full slot set for the caller (delete-then-insert)', async () => {
    const user = makeUser();

    await service.setMine(user, {
      slots: [{ dayOfWeek: 1, startTime: '17:00', endTime: '20:00' }],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    const txArg = getMockCallArg<unknown[]>(prisma.$transaction);
    expect(Array.isArray(txArg)).toBe(true);
  });

  it('should support multiple time ranges on the same day as distinct rows', async () => {
    const user = makeUser();

    await service.setMine(user, {
      slots: [
        { dayOfWeek: 1, startTime: '16:00', endTime: '18:00' },
        { dayOfWeek: 1, startTime: '19:00', endTime: '21:00' },
      ],
    });

    const txArg = getMockCallArg<unknown[]>(prisma.$transaction);
    // 1 delete + 2 creates
    expect(txArg.length).toBe(3);
  });

  it("should let a parent set a child's availability via ownerProfileId, distinct from their own", async () => {
    prisma.playerProfile.findFirst
      .mockResolvedValueOnce({ id: 'self-pp-1' }) // not used in this path
      .mockResolvedValueOnce({ id: 'child-pp-1', parentUserId: 'user-1' }); // ownership check

    const user = makeUser({ userId: 'user-1' });
    await service.setMine(user, {
      ownerProfileId: 'child-pp-1',
      slots: [{ dayOfWeek: 2, startTime: '17:00', endTime: '18:00' }],
    });

    expect(prisma.playerProfile.findFirst).toHaveBeenCalled();
  });

  it("should reject setting a child profile that is not the caller's own", async () => {
    prisma.playerProfile.findFirst.mockResolvedValue(null);

    const user = makeUser({ userId: 'user-1' });
    await expect(
      service.setMine(user, {
        ownerProfileId: 'not-my-child',
        slots: [{ dayOfWeek: 2, startTime: '17:00', endTime: '18:00' }],
      }),
    ).rejects.toThrow();
  });
});

describe('AvailabilityService.setMine (coach)', () => {
  let service: AvailabilityService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new AvailabilityService(prisma as never);
    prisma.coachProfile.findFirst.mockResolvedValue({ id: 'coach-profile-1' });
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.availability.findMany.mockResolvedValue([]);
  });

  it("should resolve ownerType=COACH from the caller's own CoachProfile", async () => {
    const user = makeUser({ role: Role.COACH });

    await service.setMine(user, {
      slots: [{ dayOfWeek: 1, startTime: '16:00', endTime: '20:00' }],
    });

    expect(prisma.coachProfile.findFirst).toHaveBeenCalled();
  });
});

describe('AvailabilityService.getForPlayerAsTrainer', () => {
  let service: AvailabilityService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new AvailabilityService(prisma as never);
  });

  it("should 404 when the player is not in the calling trainer's roster", async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue(null);

    await expect(
      service.getForPlayerAsTrainer('trainer-1', 'other-trainers-player'),
    ).rejects.toThrow();
  });

  it('should return the availability for a player in the roster', async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue({
      id: 'assoc-1',
    });
    prisma.availability.findMany.mockResolvedValue([
      { dayOfWeek: 1, startTime: '17:00', endTime: '20:00', isAvailable: true },
    ]);

    const result = await service.getForPlayerAsTrainer('trainer-1', 'player-1');
    expect(result).toHaveLength(1);
  });

  it('should scope the roster lookup to ACTIVE associations only', async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue({
      id: 'assoc-1',
    });
    prisma.availability.findMany.mockResolvedValue([]);

    await service.getForPlayerAsTrainer('trainer-1', 'player-1');

    expect(prisma.trainerPlayerAssociation.findFirst).toHaveBeenCalledWith({
      where: {
        trainerId: 'trainer-1',
        playerProfileId: 'player-1',
        status: 'ACTIVE',
      },
    });
  });

  it('should 404 when the association was REMOVED, even though a stale row still exists', async () => {
    // findFirst with a status filter simply won't match a REMOVED row —
    // this asserts the caller-visible behavior, not the query shape.
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue(null);

    await expect(
      service.getForPlayerAsTrainer('trainer-1', 'player-1'),
    ).rejects.toThrow();
  });
});

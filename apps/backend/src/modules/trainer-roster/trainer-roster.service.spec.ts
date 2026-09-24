import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { AvailabilityService } from '../availability/availability.service';
import { TrainerRosterService } from './trainer-roster.service';

const trainerId = 'trainer-1';

describe('TrainerRosterService.listOwnRoster', () => {
  let service: TrainerRosterService;
  let prisma: MockPrismaService;
  let availabilityService: { getAvailabilitySummary: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    availabilityService = {
      getAvailabilitySummary: jest.fn().mockResolvedValue('Mon 5-8pm'),
    };
    service = new TrainerRosterService(
      prisma as never,
      availabilityService as unknown as AvailabilityService,
    );
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([
      { playerProfile: { id: 'pp-1', displayName: 'Alex' } },
    ]);
    prisma.coachProfile.findMany.mockResolvedValue([
      {
        id: 'cp-1',
        user: { profile: { firstName: 'Coach', lastName: 'Bob' } },
      },
    ]);
  });

  it("should scope both players and coaches strictly to the caller's trainerId", async () => {
    await service.listOwnRoster(trainerId, 1, 20);

    const assocArgs = getMockCallArg<{ where: { trainerId: string } }>(
      prisma.trainerPlayerAssociation.findMany,
    );
    expect(assocArgs.where.trainerId).toBe(trainerId);

    const coachArgs = getMockCallArg<{ where: { trainerId: string } }>(
      prisma.coachProfile.findMany,
    );
    expect(coachArgs.where.trainerId).toBe(trainerId);
  });

  it('should combine players and coaches into one paginated roster', async () => {
    const result = await service.listOwnRoster(trainerId, 1, 20);

    expect(result.total).toBe(2);
    expect(result.items.find((m) => m.role === 'PLAYER')?.name).toBe('Alex');
    expect(result.items.find((m) => m.role === 'COACH')?.name).toBe(
      'Coach Bob',
    );
  });

  it('should paginate the combined list', async () => {
    const result = await service.listOwnRoster(trainerId, 1, 1);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});

describe('TrainerRosterService.filterByAvailability', () => {
  let service: TrainerRosterService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new TrainerRosterService(
      prisma as never,
      {
        getAvailabilitySummary: jest.fn().mockResolvedValue(''),
      } as unknown as AvailabilityService,
    );
  });

  it("should return only players available at the given day/time, scoped to the caller's roster", async () => {
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([
      { playerProfile: { id: 'pp-1', displayName: 'Available Alex' } },
      { playerProfile: { id: 'pp-2', displayName: 'Busy Bailey' } },
    ]);
    prisma.availability.findMany.mockImplementation(
      (args: { where: { ownerId: string } }) =>
        Promise.resolve(
          args.where.ownerId === 'pp-1'
            ? [
                {
                  dayOfWeek: 1,
                  startTime: '16:00',
                  endTime: '20:00',
                  isAvailable: true,
                },
              ]
            : [],
        ),
    );

    const result = await service.filterByAvailability(trainerId, 1, '17:00');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Available Alex');
    const assocArgs = getMockCallArg<{ where: { trainerId: string } }>(
      prisma.trainerPlayerAssociation.findMany,
    );
    expect(assocArgs.where.trainerId).toBe(trainerId);
  });
});

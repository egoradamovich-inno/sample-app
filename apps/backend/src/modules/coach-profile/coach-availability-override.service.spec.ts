import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { CoachAvailabilityOverrideService } from './coach-availability-override.service';

describe('CoachAvailabilityOverrideService.checkConflict', () => {
  let service: CoachAvailabilityOverrideService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CoachAvailabilityOverrideService(prisma as never);
  });

  it('should report no conflict when the requested time falls within a stored available slot', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { dayOfWeek: 1, startTime: '16:00', endTime: '20:00', isAvailable: true },
    ]);

    const result = await service.checkConflict('coach-1', {
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '18:00',
    });

    expect(result.conflict).toBe(false);
  });

  it('should report a conflict when no stored slot covers the requested time', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { dayOfWeek: 1, startTime: '16:00', endTime: '18:00', isAvailable: true },
    ]);

    const result = await service.checkConflict('coach-1', {
      dayOfWeek: 1,
      startTime: '19:00',
      endTime: '20:00',
    });

    expect(result.conflict).toBe(true);
  });

  it('should report a conflict when the coach has no availability set at all', async () => {
    prisma.availability.findMany.mockResolvedValue([]);

    const result = await service.checkConflict('coach-1', {
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '18:00',
    });

    expect(result.conflict).toBe(true);
  });
});

describe('CoachAvailabilityOverrideService.recordOverride', () => {
  let service: CoachAvailabilityOverrideService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CoachAvailabilityOverrideService(prisma as never);
  });

  it('should reject an empty or whitespace-only reason', async () => {
    await expect(
      service.recordOverride('coach-1', 'trainer-1', 'trainer-1', {
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '18:00',
        reason: '   ',
      }),
    ).rejects.toThrow();
    expect(prisma.coachAvailabilityOverride.create).not.toHaveBeenCalled();
  });

  it('should write coachId, trainerId, overriddenBy, reason, and never block the caller', async () => {
    await service.recordOverride('coach-1', 'trainer-1', 'trainer-1', {
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '18:00',
      reason: 'Only slot available this week',
    });

    const createArgs = getMockCallArg<{
      data: {
        coachId: string;
        trainerId: string;
        overriddenBy: string;
        reason: string;
      };
    }>(prisma.coachAvailabilityOverride.create);
    expect(createArgs.data.coachId).toBe('coach-1');
    expect(createArgs.data.trainerId).toBe('trainer-1');
    expect(createArgs.data.overriddenBy).toBe('trainer-1');
    expect(createArgs.data.reason).toBe('Only slot available this week');
  });
});

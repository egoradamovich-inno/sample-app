import { Injectable } from '@nestjs/common';
import { AvailabilityOwnerType } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  ConflictCheckDto,
  OverrideConflictDto,
} from './dto/conflict-check.dto';

interface AvailabilityRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

@Injectable()
export class CoachAvailabilityOverrideService {
  constructor(private readonly prisma: PrismaService) {}

  async checkConflict(
    coachId: string,
    dto: ConflictCheckDto,
  ): Promise<{ conflict: boolean }> {
    const slots = (await this.prisma.availability.findMany({
      where: {
        ownerType: AvailabilityOwnerType.COACH,
        ownerId: coachId,
        dayOfWeek: dto.dayOfWeek,
      },
    })) as AvailabilityRow[];

    const covered = slots.some(
      (slot) =>
        slot.isAvailable &&
        slot.startTime <= dto.startTime &&
        slot.endTime >= dto.endTime,
    );

    return { conflict: !covered };
  }

  async recordOverride(
    coachId: string,
    trainerId: string,
    overriddenBy: string,
    dto: OverrideConflictDto,
  ): Promise<void> {
    if (dto.reason.trim().length === 0) {
      throw new AppException(
        'VALIDATION_ERROR',
        'A reason is required to override a coach availability conflict',
        400,
      );
    }

    // Never blocks the caller — this only logs. The coach sees the
    // resulting assignment (once Epic-02's Event entity exists) and can
    // accept or request a change; this endpoint doesn't gate that.
    await this.prisma.coachAvailabilityOverride.create({
      data: {
        eventId: dto.eventId,
        coachId,
        trainerId,
        overriddenBy,
        reason: dto.reason,
      },
    });
  }
}

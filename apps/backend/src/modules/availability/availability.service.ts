import { Injectable } from '@nestjs/common';
import { AvailabilityOwnerType, Role } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  AvailabilitySlotDto,
  SetAvailabilityDto,
} from './dto/availability-slot.dto';

interface AvailabilityRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async setMine(
    user: AuthenticatedUser,
    dto: SetAvailabilityDto,
  ): Promise<AvailabilitySlotDto[]> {
    const { ownerType, ownerId } = await this.resolveOwner(
      user,
      dto.ownerProfileId,
    );

    await this.prisma.$transaction([
      this.prisma.availability.deleteMany({ where: { ownerType, ownerId } }),
      ...dto.slots.map((slot) =>
        this.prisma.availability.create({
          data: {
            ownerType,
            ownerId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: slot.isAvailable ?? true,
          },
        }),
      ),
    ]);

    return this.getAvailability(ownerType, ownerId);
  }

  async getMine(
    user: AuthenticatedUser,
    ownerProfileId?: string,
  ): Promise<AvailabilitySlotDto[]> {
    const { ownerType, ownerId } = await this.resolveOwner(
      user,
      ownerProfileId,
    );
    return this.getAvailability(ownerType, ownerId);
  }

  async getForPlayerAsTrainer(
    trainerId: string,
    playerProfileId: string,
  ): Promise<AvailabilitySlotDto[]> {
    const association = await this.prisma.trainerPlayerAssociation.findFirst({
      where: { trainerId, playerProfileId, status: 'ACTIVE' },
    });
    if (!association) {
      throw new AppException(
        'PLAYER_PROFILE_NOT_FOUND',
        'This player is not in your roster',
        404,
      );
    }
    return this.getAvailability(AvailabilityOwnerType.PLAYER, playerProfileId);
  }

  /** Human-readable summary for the trainer roster view, e.g.
   * "Mon 5-8pm, Wed 6-9pm" — consumed by TrainerRosterService for both
   * players and coaches. */
  async getAvailabilitySummary(
    ownerType: AvailabilityOwnerType,
    ownerId: string,
  ): Promise<string> {
    const slots = await this.getAvailability(ownerType, ownerId);
    const available = slots.filter((s) => s.isAvailable !== false);
    if (available.length === 0) {
      return 'No availability set';
    }
    return available
      .map((s) => `${DAY_ABBREVIATIONS[s.dayOfWeek]} ${this.formatRange(s)}`)
      .join(', ');
  }

  private formatRange(slot: AvailabilitySlotDto): string {
    return `${slot.startTime}-${slot.endTime}`;
  }

  private async getAvailability(
    ownerType: AvailabilityOwnerType,
    ownerId: string,
  ): Promise<AvailabilitySlotDto[]> {
    const rows = (await this.prisma.availability.findMany({
      where: { ownerType, ownerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })) as AvailabilityRow[];

    return rows.map((row) => {
      const dto = new AvailabilitySlotDto();
      dto.dayOfWeek = row.dayOfWeek;
      dto.startTime = row.startTime;
      dto.endTime = row.endTime;
      dto.isAvailable = row.isAvailable;
      return dto;
    });
  }

  private async resolveOwner(
    user: AuthenticatedUser,
    ownerProfileId?: string,
  ): Promise<{ ownerType: AvailabilityOwnerType; ownerId: string }> {
    if (user.role === Role.COACH) {
      const coachProfile = (await this.prisma.coachProfile.findFirst({
        where: { userId: user.userId },
      })) as { id: string } | null;
      if (!coachProfile) {
        throw new AppException(
          'COACH_PROFILE_NOT_FOUND',
          'No coach profile found for this account',
          404,
        );
      }
      return {
        ownerType: AvailabilityOwnerType.COACH,
        ownerId: coachProfile.id,
      };
    }

    if (ownerProfileId) {
      const child = (await this.prisma.playerProfile.findFirst({
        where: { id: ownerProfileId, parentUserId: user.userId },
      })) as { id: string } | null;
      if (!child) {
        throw new AppException(
          'PLAYER_PROFILE_NOT_FOUND',
          'This player profile was not found in your family',
          404,
        );
      }
      return { ownerType: AvailabilityOwnerType.PLAYER, ownerId: child.id };
    }

    const own = (await this.prisma.playerProfile.findFirst({
      where: { userId: user.userId },
    })) as { id: string } | null;
    if (!own) {
      throw new AppException(
        'PLAYER_PROFILE_NOT_FOUND',
        'No player profile found for this account',
        404,
      );
    }
    return { ownerType: AvailabilityOwnerType.PLAYER, ownerId: own.id };
  }
}

import { Injectable } from '@nestjs/common';
import { AvailabilityOwnerType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PaginatedRosterDto, RosterMemberDto } from './dto/roster-member.dto';

interface PlayerAssociationRow {
  playerProfile: { id: string; displayName: string };
}

interface CoachProfileRow {
  id: string;
  user: { profile: { firstName: string; lastName: string } | null } | null;
}

interface AvailabilityRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

@Injectable()
export class TrainerRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async listOwnRoster(
    trainerId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRosterDto> {
    const [associations, coachProfiles] = await Promise.all([
      this.prisma.trainerPlayerAssociation.findMany({
        where: { trainerId, status: 'ACTIVE' },
        include: { playerProfile: true },
      }) as Promise<PlayerAssociationRow[]>,
      this.prisma.coachProfile.findMany({
        where: { trainerId },
        include: { user: { include: { profile: true } } },
      }) as Promise<CoachProfileRow[]>,
    ]);

    const playerMembers = await Promise.all(
      associations.map((assoc) => this.toPlayerMember(assoc)),
    );
    const coachMembers = await Promise.all(
      coachProfiles.map((cp) => this.toCoachMember(cp)),
    );

    const all = [...playerMembers, ...coachMembers];
    const start = (page - 1) * pageSize;

    const dto = new PaginatedRosterDto();
    dto.items = all.slice(start, start + pageSize);
    dto.total = all.length;
    dto.page = page;
    dto.pageSize = pageSize;
    return dto;
  }

  async filterByAvailability(
    trainerId: string,
    dayOfWeek: number,
    time: string,
  ): Promise<RosterMemberDto[]> {
    const associations = (await this.prisma.trainerPlayerAssociation.findMany({
      where: { trainerId, status: 'ACTIVE' },
      include: { playerProfile: true },
    })) as PlayerAssociationRow[];

    const results: RosterMemberDto[] = [];
    for (const assoc of associations) {
      const isAvailable = await this.isAvailableAt(
        assoc.playerProfile.id,
        dayOfWeek,
        time,
      );
      if (isAvailable) {
        results.push(await this.toPlayerMember(assoc));
      }
    }
    return results;
  }

  private async isAvailableAt(
    playerProfileId: string,
    dayOfWeek: number,
    time: string,
  ): Promise<boolean> {
    const slots = (await this.prisma.availability.findMany({
      where: {
        ownerType: AvailabilityOwnerType.PLAYER,
        ownerId: playerProfileId,
        dayOfWeek,
      },
    })) as AvailabilityRow[];

    return slots.some(
      (slot) =>
        slot.isAvailable && slot.startTime <= time && slot.endTime >= time,
    );
  }

  private async toPlayerMember(
    assoc: PlayerAssociationRow,
  ): Promise<RosterMemberDto> {
    const dto = new RosterMemberDto();
    dto.id = assoc.playerProfile.id;
    dto.name = assoc.playerProfile.displayName;
    dto.role = 'PLAYER';
    dto.availabilitySummary =
      await this.availabilityService.getAvailabilitySummary(
        AvailabilityOwnerType.PLAYER,
        assoc.playerProfile.id,
      );
    return dto;
  }

  private async toCoachMember(cp: CoachProfileRow): Promise<RosterMemberDto> {
    const dto = new RosterMemberDto();
    dto.id = cp.id;
    dto.name = cp.user?.profile
      ? `${cp.user.profile.firstName} ${cp.user.profile.lastName}`
      : 'Coach';
    dto.role = 'COACH';
    dto.availabilitySummary =
      await this.availabilityService.getAvailabilitySummary(
        AvailabilityOwnerType.COACH,
        cp.id,
      );
    return dto;
  }
}

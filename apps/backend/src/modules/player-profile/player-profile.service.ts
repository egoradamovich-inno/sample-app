import { Injectable } from '@nestjs/common';
import { AppException } from '../../shared/errors/app-exception';
import { assertNotChildAccount } from '../../shared/errors/assert-not-child-account.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateChildProfileDto } from './dto/create-child-profile.dto';
import {
  CreateChildProfileResponseDto,
  PlayerProfileSummaryDto,
} from './dto/player-profile-summary.dto';

const MIN_CHILD_AGE = 1;
const MAX_CHILD_AGE = 18;

interface PlayerProfileRow {
  id: string;
  displayName: string;
  birthDate: Date | null;
  isChild: boolean;
  userId?: string | null;
}

interface AssociationRow {
  trainerId: string;
  playerProfileId: string;
  status?: string;
}

@Injectable()
export class PlayerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async createChildProfile(
    parentUserId: string,
    dto: CreateChildProfileDto,
    isChildAccount: boolean,
  ): Promise<CreateChildProfileResponseDto> {
    assertNotChildAccount(isChildAccount);

    const birthDate = new Date(dto.birthDate);
    const age = this.computeAge(birthDate);
    if (age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Child age must be between 1 and 18 years',
        400,
      );
    }

    const duplicateWarning = await this.hasDuplicateSibling(
      parentUserId,
      dto.displayName,
      birthDate,
    );

    const child = (await this.prisma.playerProfile.create({
      data: {
        parentUserId,
        displayName: dto.displayName,
        birthDate,
        gender: dto.gender,
        school: dto.school,
        isChild: true,
      },
    })) as PlayerProfileRow;

    let trainerSelectionPrompt: 'single' | 'multi' | null = null;

    if (dto.associateTrainerIds && dto.associateTrainerIds.length > 0) {
      for (const trainerId of dto.associateTrainerIds) {
        await this.prisma.trainerPlayerAssociation.create({
          data: { trainerId, playerProfileId: child.id },
        });
      }
    } else {
      const distinctTrainerIds =
        await this.getDistinctFamilyTrainerIds(parentUserId);
      if (distinctTrainerIds.length === 1) {
        trainerSelectionPrompt = 'single';
      } else if (distinctTrainerIds.length > 1) {
        trainerSelectionPrompt = 'multi';
      }
    }

    const summary = await this.toSummary(child.id, child);
    const response = Object.assign(
      new CreateChildProfileResponseDto(),
      summary,
    );
    response.duplicateWarning = duplicateWarning || undefined;
    response.trainerSelectionPrompt = trainerSelectionPrompt;
    return response;
  }

  async listOwnFamily(
    parentUserId: string,
  ): Promise<PlayerProfileSummaryDto[]> {
    const profiles = (await this.prisma.playerProfile.findMany({
      where: {
        OR: [{ userId: parentUserId }, { parentUserId, isChild: true }],
      },
    })) as PlayerProfileRow[];

    const associationsByProfile = await this.getAssociationsGroupedByProfile(
      profiles.map((p) => p.id),
    );
    const trainerNames = await this.getTrainerNames(
      [...associationsByProfile.values()].flat().map((a) => a.trainerId),
    );

    return profiles.map((profile) =>
      this.buildSummary(
        profile,
        associationsByProfile.get(profile.id) ?? [],
        trainerNames,
      ),
    );
  }

  /** Reused by sibling services (TrainerAssociationService) that mutate an
   * association and need to return the refreshed PlayerProfileSummaryDto. */
  async getSummary(playerProfileId: string): Promise<PlayerProfileSummaryDto> {
    const profile = (await this.prisma.playerProfile.findUnique({
      where: { id: playerProfileId },
    })) as PlayerProfileRow;
    return this.toSummary(playerProfileId, profile);
  }

  /** Idempotently ensures a "self" (non-child) PlayerProfile exists for a
   * user, returning the existing one if already provisioned. Reused by
   * CampConversionService.consumeDraft so a camp-conversion registration
   * can hand the result straight to TrainerAssociationService rather than
   * re-implementing profile-then-associate wiring. */
  async ensureSelfProfile(
    userId: string,
    displayName: string,
  ): Promise<{ id: string }> {
    const existing = (await this.prisma.playerProfile.findUnique({
      where: { userId },
    })) as { id: string } | null;
    if (existing) {
      return existing;
    }
    return await this.prisma.playerProfile.create({
      data: { userId, parentUserId: userId, displayName, isChild: false },
    });
  }

  private async toSummary(
    playerProfileId: string,
    preloaded: PlayerProfileRow,
  ): Promise<PlayerProfileSummaryDto> {
    const associationsByProfile = await this.getAssociationsGroupedByProfile([
      playerProfileId,
    ]);
    const associations = associationsByProfile.get(playerProfileId) ?? [];
    const trainerNames = await this.getTrainerNames(
      associations.map((a) => a.trainerId),
    );
    return this.buildSummary(preloaded, associations, trainerNames);
  }

  private buildSummary(
    profile: PlayerProfileRow,
    associations: AssociationRow[],
    trainerNames: Map<string, string>,
  ): PlayerProfileSummaryDto {
    const dto = new PlayerProfileSummaryDto();
    dto.id = profile.id;
    dto.displayName = profile.displayName;
    dto.birthDate = profile.birthDate ? profile.birthDate.toISOString() : null;
    dto.isChild = profile.isChild;
    dto.trainerAssociations = associations.map((assoc) => ({
      trainerId: assoc.trainerId,
      trainerName: trainerNames.get(assoc.trainerId) ?? 'Trainer',
      status: assoc.status ?? 'ACTIVE',
    }));
    return dto;
  }

  private async getAssociationsGroupedByProfile(
    playerProfileIds: string[],
  ): Promise<Map<string, AssociationRow[]>> {
    const associations = (await this.prisma.trainerPlayerAssociation.findMany({
      where: { playerProfileId: { in: playerProfileIds } },
    })) as AssociationRow[];

    const grouped = new Map<string, AssociationRow[]>();
    for (const assoc of associations) {
      const existing = grouped.get(assoc.playerProfileId) ?? [];
      existing.push(assoc);
      grouped.set(assoc.playerProfileId, existing);
    }
    return grouped;
  }

  private async getTrainerNames(
    trainerIds: string[],
  ): Promise<Map<string, string>> {
    const distinctIds = [...new Set(trainerIds)];
    if (distinctIds.length === 0) {
      return new Map();
    }
    const trainers = (await this.prisma.user.findMany({
      where: { id: { in: distinctIds } },
      include: { trainerProfile: true },
    })) as { id: string; trainerProfile: { businessName: string } | null }[];

    return new Map(
      trainers.map((t) => [t.id, t.trainerProfile?.businessName ?? 'Trainer']),
    );
  }

  private async hasDuplicateSibling(
    parentUserId: string,
    displayName: string,
    birthDate: Date,
  ): Promise<boolean> {
    const siblings = (await this.prisma.playerProfile.findMany({
      where: { parentUserId, isChild: true },
    })) as PlayerProfileRow[];

    return siblings.some(
      (sibling) =>
        sibling.displayName.toLowerCase() === displayName.toLowerCase() &&
        sibling.birthDate !== null &&
        this.computeAge(sibling.birthDate) === this.computeAge(birthDate),
    );
  }

  private async getDistinctFamilyTrainerIds(
    parentUserId: string,
  ): Promise<string[]> {
    const familyProfiles = (await this.prisma.playerProfile.findMany({
      where: {
        OR: [{ userId: parentUserId }, { parentUserId, isChild: true }],
      },
    })) as PlayerProfileRow[];
    const profileIds = familyProfiles.map((p) => p.id);

    const associations = (await this.prisma.trainerPlayerAssociation.findMany({
      where: { playerProfileId: { in: profileIds } },
    })) as AssociationRow[];

    return [...new Set(associations.map((a) => a.trainerId))];
  }

  private computeAge(birthDate: Date): number {
    const diffMs = Date.now() - birthDate.getTime();
    return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  }
}

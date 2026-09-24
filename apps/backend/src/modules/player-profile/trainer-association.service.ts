import { Injectable } from '@nestjs/common';
import { ShareLinkType } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { assertNotChildAccount } from '../../shared/errors/assert-not-child-account.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AddTrainerAssociationDto } from './dto/add-trainer-association.dto';
import { PlayerProfileSummaryDto } from './dto/player-profile-summary.dto';
import { PlayerProfileService } from './player-profile.service';

export interface RemoveAssociationResult {
  cancelledUpcomingRsvps: true;
}

@Injectable()
export class TrainerAssociationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerProfileService: PlayerProfileService,
  ) {}

  async addTrainerAssociation(
    parentUserId: string,
    playerProfileId: string,
    dto: AddTrainerAssociationDto,
    isChildAccount: boolean,
  ): Promise<PlayerProfileSummaryDto> {
    assertNotChildAccount(isChildAccount);
    await this.assertOwnership(parentUserId, playerProfileId);

    const trainerId = await this.resolveTrainerId(dto);

    const existing = (await this.prisma.trainerPlayerAssociation.findFirst({
      where: { trainerId, playerProfileId },
    })) as { id: string; status: string } | null;

    if (!existing) {
      await this.prisma.trainerPlayerAssociation.create({
        data: { trainerId, playerProfileId },
      });
    } else if (existing.status !== 'ACTIVE') {
      await this.prisma.trainerPlayerAssociation.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      });
    }

    return this.playerProfileService.getSummary(playerProfileId);
  }

  async removeTrainerAssociation(
    parentUserId: string,
    playerProfileId: string,
    trainerId: string,
    isChildAccount: boolean,
  ): Promise<RemoveAssociationResult> {
    assertNotChildAccount(isChildAccount);
    await this.assertOwnership(parentUserId, playerProfileId);

    const association = (await this.prisma.trainerPlayerAssociation.findFirst({
      where: { trainerId, playerProfileId },
    })) as { id: string } | null;

    if (!association) {
      throw new AppException(
        'ASSOCIATION_NOT_FOUND',
        'This trainer association was not found',
        404,
      );
    }

    // Soft-delete only — row kept, history preserved, trainer stops seeing
    // this player in their live roster (a separate roster query's concern,
    // not this one's).
    await this.prisma.trainerPlayerAssociation.update({
      where: { id: association.id },
      data: { status: 'REMOVED' },
    });

    return { cancelledUpcomingRsvps: true };
  }

  private async resolveTrainerId(
    dto: AddTrainerAssociationDto,
  ): Promise<string> {
    if (dto.trainerId) {
      return dto.trainerId;
    }
    if (dto.shareLinkCode) {
      const link = (await this.prisma.shareLink.findUnique({
        where: { code: dto.shareLinkCode },
      })) as { trainerId: string; type: ShareLinkType } | null;
      if (!link || link.type !== ShareLinkType.STATIC) {
        throw new AppException(
          'SHARELINK_NOT_FOUND',
          'This invite link was not found',
          404,
        );
      }
      return link.trainerId;
    }
    throw new AppException(
      'VALIDATION_ERROR',
      'Either shareLinkCode or trainerId is required',
      400,
    );
  }

  private async assertOwnership(
    parentUserId: string,
    playerProfileId: string,
  ): Promise<void> {
    const owned = (await this.prisma.playerProfile.findFirst({
      where: {
        id: playerProfileId,
        OR: [{ userId: parentUserId }, { parentUserId }],
      },
    })) as { id: string } | null;

    if (!owned) {
      throw new AppException(
        'PLAYER_PROFILE_NOT_FOUND',
        'This player profile was not found in your family',
        404,
      );
    }
  }
}

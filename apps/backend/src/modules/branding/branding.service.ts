import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { STORAGE_SERVICE } from '../../shared/storage/storage.service';
import type { StorageService } from '../../shared/storage/storage.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BrandingDto, UpdateBrandingDto } from './dto/branding.dto';

interface TrainerProfileWithBranding {
  id: string;
  branding: { logoUrl: string | null; primaryColorHex: string | null } | null;
}

interface BrandingRow {
  logoUrl: string | null;
  primaryColorHex: string | null;
}

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async getBranding(trainerId: string): Promise<BrandingDto> {
    const trainerProfile = await this.getTrainerProfileOrThrow(trainerId);
    return this.toDto(trainerProfile.branding);
  }

  /** Branding is readable by any authenticated user in a trainer's org, not
   * just the trainer — resolves which trainer's branding to return for the
   * shared /trainer/branding GET, since a PLAYER may belong to several. */
  async resolveTrainerIdForCaller(
    user: AuthenticatedUser,
    explicitTrainerId?: string,
  ): Promise<string> {
    if (explicitTrainerId) {
      return explicitTrainerId;
    }
    if (user.role === Role.TRAINER) {
      return user.userId;
    }
    if (user.role === Role.COACH) {
      const coachProfile = (await this.prisma.coachProfile.findFirst({
        where: { userId: user.userId },
      })) as { trainerId: string } | null;
      if (!coachProfile) {
        throw new AppException(
          'COACH_PROFILE_NOT_FOUND',
          'No coach profile found for this account',
          404,
        );
      }
      return coachProfile.trainerId;
    }
    throw new AppException(
      'VALIDATION_ERROR',
      'trainerId is required to resolve branding for this account',
      400,
    );
  }

  async updateBranding(
    trainerId: string,
    dto: UpdateBrandingDto,
  ): Promise<BrandingDto> {
    const trainerProfile = await this.getTrainerProfileOrThrow(trainerId);
    const branding = (await this.prisma.branding.upsert({
      where: { trainerProfileId: trainerProfile.id },
      create: {
        trainerProfileId: trainerProfile.id,
        primaryColorHex: dto.primaryColorHex,
      },
      update: { primaryColorHex: dto.primaryColorHex },
    })) as BrandingRow;
    return this.toDto(branding);
  }

  async uploadLogo(trainerId: string, buffer: Buffer): Promise<BrandingDto> {
    const trainerProfile = await this.getTrainerProfileOrThrow(trainerId);
    const saved = await this.storageService.saveLogo(buffer, trainerId);

    if (trainerProfile.branding?.logoUrl) {
      await this.storageService.delete(trainerProfile.branding.logoUrl);
    }

    const branding = (await this.prisma.branding.upsert({
      where: { trainerProfileId: trainerProfile.id },
      create: { trainerProfileId: trainerProfile.id, logoUrl: saved.url },
      update: { logoUrl: saved.url },
    })) as BrandingRow;
    return this.toDto(branding);
  }

  private async getTrainerProfileOrThrow(
    trainerId: string,
  ): Promise<TrainerProfileWithBranding> {
    const trainerProfile = (await this.prisma.trainerProfile.findUnique({
      where: { userId: trainerId },
      include: { branding: true },
    })) as TrainerProfileWithBranding | null;

    if (!trainerProfile) {
      throw new AppException(
        'TRAINER_NOT_FOUND',
        'Trainer profile not found',
        404,
      );
    }
    return trainerProfile;
  }

  private toDto(branding: BrandingRow | null): BrandingDto {
    const dto = new BrandingDto();
    dto.logoUrl = branding?.logoUrl ?? null;
    dto.primaryColorHex = branding?.primaryColorHex ?? null;
    return dto;
  }
}

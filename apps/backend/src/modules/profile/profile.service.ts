import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { STORAGE_SERVICE } from '../../shared/storage/storage.service';
import type { StorageService } from '../../shared/storage/storage.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface PrismaP2025Error {
  code?: string;
}

/**
 * Prisma throws P2025 ("record to update not found") when a bare `.update()`
 * targets a row that doesn't exist. For the per-role sub-profile tables this
 * is an expected state, not a bug — plenty of live TRAINER/PLAYER rows and
 * the seed admin account have no matching Profile/TrainerProfile/
 * CoachProfile/PlayerProfile row. Distinguish it so it can be surfaced as a
 * clean 4xx instead of falling through to a generic 500.
 */
function isP2025(error: unknown): boolean {
  return (error as PrismaP2025Error)?.code === 'P2025';
}

interface FullUser {
  id: string;
  email: string;
  role: Role;
  status: string;
  createdAt: Date;
  profile: {
    firstName: string;
    lastName: string;
    phone: string | null;
    photoUrl: string | null;
    school: string | null;
  } | null;
  trainerProfile: {
    businessName: string;
    address: string | null;
    website: string | null;
    description: string | null;
  } | null;
  coachProfile: {
    bio: string | null;
    credentials: string | null;
    certifications: string[];
    publicVisible: boolean;
  } | null;
  playerProfile: {
    skillLevel: string | null;
    jerseyNumber: string | null;
    emergencyContact: string | null;
  } | null;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async getOwnProfile(userId: string): Promise<ProfileResponseDto> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        trainerProfile: true,
        coachProfile: true,
        playerProfile: true,
      },
    })) as FullUser;

    return this.toResponseDto(user);
  }

  async updateOwnProfile(
    userId: string,
    role: Role,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const { firstName, lastName, phone, school, ...roleFields } = dto;
    const commonFields = { firstName, lastName, phone, school };
    const definedCommonFields = this.withoutUndefined(commonFields);

    if (Object.keys(definedCommonFields).length > 0) {
      try {
        await this.prisma.profile.update({
          where: { userId },
          data: definedCommonFields,
        });
      } catch (error) {
        if (isP2025(error)) {
          throw new AppException(
            'PROFILE_NOT_PROVISIONED',
            'Your profile has not been provisioned yet',
            404,
          );
        }
        throw error;
      }
    }

    if (role === Role.TRAINER) {
      const { businessName, address, website, description } = roleFields;
      const fields = this.withoutUndefined({
        businessName,
        address,
        website,
        description,
      });
      if (Object.keys(fields).length > 0) {
        try {
          await this.prisma.trainerProfile.update({
            where: { userId },
            data: fields,
          });
        } catch (error) {
          if (isP2025(error)) {
            throw new AppException(
              'TRAINER_PROFILE_NOT_PROVISIONED',
              'Your trainer profile has not been provisioned yet',
              404,
            );
          }
          throw error;
        }
      }
    } else if (role === Role.COACH) {
      const { bio, credentials, certifications, publicVisible } = roleFields;
      const fields = this.withoutUndefined({
        bio,
        credentials,
        certifications,
        publicVisible,
      });
      if (Object.keys(fields).length > 0) {
        try {
          await this.prisma.coachProfile.update({
            where: { userId },
            data: fields,
          });
        } catch (error) {
          if (isP2025(error)) {
            throw new AppException(
              'COACH_PROFILE_NOT_PROVISIONED',
              'Your coach profile has not been provisioned yet',
              404,
            );
          }
          throw error;
        }
      }
    } else if (role === Role.PLAYER) {
      const { jerseyNumber, emergencyContact } = roleFields;
      const fields = this.withoutUndefined({ jerseyNumber, emergencyContact });
      if (Object.keys(fields).length > 0) {
        try {
          await this.prisma.playerProfile.update({
            where: { userId },
            data: fields,
          });
        } catch (error) {
          if (isP2025(error)) {
            throw new AppException(
              'PLAYER_PROFILE_NOT_PROVISIONED',
              'Your player profile has not been provisioned yet',
              404,
            );
          }
          throw error;
        }
      }
    }

    return this.getOwnProfile(userId);
  }

  async uploadPhoto(
    userId: string,
    buffer: Buffer,
  ): Promise<ProfileResponseDto> {
    const existing = (await this.prisma.profile.findUnique({
      where: { userId },
    })) as { photoUrl: string | null } | null;

    const saved = await this.storageService.savePhoto(buffer, userId);

    await this.prisma.profile.update({
      where: { userId },
      data: { photoUrl: saved.url },
    });

    if (existing?.photoUrl) {
      await this.storageService.delete(existing.photoUrl);
    }

    return this.getOwnProfile(userId);
  }

  private withoutUndefined<T extends Record<string, unknown>>(
    obj: T,
  ): Partial<T> {
    const result: Partial<T> = {};
    for (const key of Object.keys(obj) as (keyof T)[]) {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  private toResponseDto(user: FullUser): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role;
    dto.status = user.status as ProfileResponseDto['status'];
    dto.createdAt = user.createdAt.toISOString();
    dto.firstName = user.profile?.firstName ?? '';
    dto.lastName = user.profile?.lastName ?? '';
    dto.phone = user.profile?.phone ?? null;
    dto.photoUrl = user.profile?.photoUrl ?? null;
    dto.school = user.profile?.school ?? null;
    dto.businessName = user.trainerProfile?.businessName ?? null;
    dto.address = user.trainerProfile?.address ?? null;
    dto.website = user.trainerProfile?.website ?? null;
    dto.description = user.trainerProfile?.description ?? null;
    dto.bio = user.coachProfile?.bio ?? null;
    dto.credentials = user.coachProfile?.credentials ?? null;
    dto.certifications = user.coachProfile?.certifications ?? [];
    dto.publicVisible = user.coachProfile?.publicVisible ?? false;
    dto.skillLevel = user.playerProfile?.skillLevel ?? null;
    dto.jerseyNumber = user.playerProfile?.jerseyNumber ?? null;
    dto.emergencyContact = user.playerProfile?.emergencyContact ?? null;
    return dto;
  }
}

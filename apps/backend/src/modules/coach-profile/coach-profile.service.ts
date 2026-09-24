import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { UserStatus } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  CoachProfileDto,
  PublicCoachProfileDto,
  UpdateCoachProfileDto,
} from './dto/coach-profile.dto';

const MAX_SLUG_RETRIES = 5;

interface PrismaP2002Error {
  code?: string;
}

function isP2002(error: unknown): boolean {
  return (error as PrismaP2002Error)?.code === 'P2002';
}

interface CoachProfileRow {
  bio: string | null;
  credentials: string | null;
  certifications: string[];
  publicVisible: boolean;
  publicSlug: string | null;
}

@Injectable()
export class CoachProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    userId: string,
    dto: UpdateCoachProfileDto,
  ): Promise<CoachProfileDto> {
    const existing = (await this.prisma.coachProfile.findUnique({
      where: { userId },
    })) as { publicVisible: boolean; publicSlug: string | null } | null;

    if (!existing) {
      throw new AppException(
        'COACH_PROFILE_NOT_FOUND',
        'No coach profile found for this account',
        404,
      );
    }

    const willBePublic = dto.publicVisible ?? existing.publicVisible;
    const needsSlug = willBePublic && !existing.publicSlug;

    const baseData = {
      bio: dto.bio,
      credentials: dto.credentials,
      certifications: dto.certifications,
      publicVisible: dto.publicVisible,
    };

    const updated = needsSlug
      ? await this.updateWithFreshSlug(userId, baseData)
      : ((await this.prisma.coachProfile.update({
          where: { userId },
          data: baseData,
        })) as CoachProfileRow);

    return this.toDto(updated);
  }

  async getPublicProfile(slug: string): Promise<PublicCoachProfileDto> {
    const profile = (await this.prisma.coachProfile.findUnique({
      where: { publicSlug: slug },
      include: { user: { include: { profile: true } } },
    })) as {
      bio: string | null;
      credentials: string | null;
      certifications: string[];
      publicVisible: boolean;
      user: {
        status: UserStatus;
        profile: { firstName: string; lastName: string } | null;
      };
    } | null;

    // Uniform 404 for not-found, not-public, and deactivated/deleted — no
    // way to distinguish the three cases from the response (anti-
    // enumeration).
    if (
      !profile ||
      !profile.publicVisible ||
      profile.user.status !== UserStatus.ACTIVE
    ) {
      throw new AppException('COACH_PROFILE_NOT_FOUND', 'Not found', 404);
    }

    const dto = new PublicCoachProfileDto();
    dto.name = profile.user.profile
      ? `${profile.user.profile.firstName} ${profile.user.profile.lastName}`
      : 'Coach';
    dto.bio = profile.bio;
    dto.credentials = profile.credentials;
    dto.certifications = profile.certifications;
    return dto;
  }

  private async updateWithFreshSlug(
    userId: string,
    data: Partial<UpdateCoachProfileDto>,
    retriesLeft = MAX_SLUG_RETRIES,
  ): Promise<CoachProfileRow> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })) as { profile: { firstName: string; lastName: string } | null } | null;

    const slug = this.generateSlugCandidate(user?.profile ?? null);

    try {
      return await this.prisma.coachProfile.update({
        where: { userId },
        data: { ...data, publicSlug: slug },
      });
    } catch (error) {
      if (isP2002(error) && retriesLeft > 0) {
        return this.updateWithFreshSlug(userId, data, retriesLeft - 1);
      }
      throw error;
    }
  }

  private generateSlugCandidate(
    profile: { firstName: string; lastName: string } | null,
  ): string {
    const base = profile
      ? `${profile.firstName}-${profile.lastName}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '')
      : 'coach';
    const suffix = randomInt(1000, 9999);
    return `${base}-${suffix}`;
  }

  private toDto(row: CoachProfileRow): CoachProfileDto {
    const dto = new CoachProfileDto();
    dto.bio = row.bio;
    dto.credentials = row.credentials;
    dto.certifications = row.certifications;
    dto.publicVisible = row.publicVisible;
    dto.publicSlug = row.publicSlug;
    return dto;
  }
}

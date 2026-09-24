import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ShareLinkType } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CoachInviteListItemDto } from './dto/coach-invite-list-item.dto';
import { CoachInviteResponseDto } from './dto/coach-invite-response.dto';
import { StaticLinkResponseDto } from './dto/static-link-response.dto';
import { ShareLinkExhaustedException } from './exceptions/sharelink-exhausted.exception';
import { ShareLinkExpiredException } from './exceptions/sharelink-expired.exception';
import { ShareLinkNotFoundException } from './exceptions/sharelink-not-found.exception';

const COACH_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CODE_RETRIES = 5;

/** Shared by every ShareLink-consuming service (player registration, coach
 * invite acceptance) so the active/expired/exhausted validation rules live
 * in exactly one place. */
export interface ActiveShareLink {
  id: string;
  code: string;
  type: ShareLinkType;
  trainerId: string;
  targetEmail: string | null;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
}

interface PrismaP2002Error {
  code?: string;
}

function isP2002(error: unknown): boolean {
  return (error as PrismaP2002Error)?.code === 'P2002';
}

function generateCode(): string {
  return randomBytes(9).toString('base64url');
}

@Injectable()
export class ShareLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async generateStaticLink(
    trainerId: string,
    createdById: string,
  ): Promise<StaticLinkResponseDto> {
    const link = await this.createWithRetry(() =>
      this.prisma.shareLink.create({
        data: {
          code: generateCode(),
          type: ShareLinkType.STATIC,
          trainerId,
          createdById,
          expiresAt: null,
          maxUses: null,
        },
      }),
    );

    const dto = new StaticLinkResponseDto();
    dto.code = link.code;
    dto.url = this.buildJoinUrl(link.code);
    return dto;
  }

  async generateCoachInvite(
    trainerId: string,
    createdById: string,
    targetEmail: string,
  ): Promise<CoachInviteResponseDto> {
    await this.assertNoConflictingPendingInvite(trainerId, targetEmail);

    const expiresAt = new Date(Date.now() + COACH_INVITE_TTL_MS);
    const link = await this.createWithRetry(() =>
      this.prisma.shareLink.create({
        data: {
          code: generateCode(),
          type: ShareLinkType.UNIQUE,
          trainerId,
          createdById,
          targetEmail,
          expiresAt,
          maxUses: 1,
        },
      }),
    );

    return this.toCoachInviteResponse(link);
  }

  async resendInvite(
    trainerId: string,
    linkId: string,
  ): Promise<CoachInviteResponseDto> {
    const existing = (await this.prisma.shareLink.findFirst({
      where: { id: linkId, trainerId, type: ShareLinkType.UNIQUE },
    })) as { id: string; targetEmail: string | null } | null;

    if (!existing || !existing.targetEmail) {
      throw new AppException('SHARELINK_NOT_FOUND', 'Invite not found', 404);
    }

    // Deactivate first — never leave two simultaneously-active links for the
    // same pending invite.
    await this.prisma.shareLink.update({
      where: { id: existing.id },
      data: { active: false },
    });

    return this.generateCoachInvite(trainerId, trainerId, existing.targetEmail);
  }

  async getActiveLinkOrThrow(code: string): Promise<ActiveShareLink> {
    const link = (await this.prisma.shareLink.findUnique({
      where: { code },
    })) as ActiveShareLink | null;

    if (!link) {
      throw new ShareLinkNotFoundException();
    }
    if (!link.active) {
      throw new ShareLinkExhaustedException();
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      throw new ShareLinkExpiredException();
    }
    if (link.maxUses !== null && link.useCount >= link.maxUses) {
      throw new ShareLinkExhaustedException();
    }
    return link;
  }

  async listCoachInvites(trainerId: string): Promise<CoachInviteListItemDto[]> {
    const links = (await this.prisma.shareLink.findMany({
      where: { trainerId, type: ShareLinkType.UNIQUE },
      orderBy: { createdAt: 'desc' },
    })) as {
      id: string;
      targetEmail: string | null;
      active: boolean;
      useCount: number;
      expiresAt: Date | null;
      createdAt: Date;
    }[];

    return links.map((link) => {
      const dto = new CoachInviteListItemDto();
      dto.id = link.id;
      dto.targetEmail = link.targetEmail ?? '';
      dto.status = this.deriveStatus(link);
      dto.createdAt = link.createdAt.toISOString();
      dto.expiresAt = link.expiresAt ? link.expiresAt.toISOString() : '';
      return dto;
    });
  }

  private deriveStatus(link: {
    active: boolean;
    useCount: number;
    expiresAt: Date | null;
  }): 'PENDING' | 'ACCEPTED' | 'EXPIRED' {
    if (link.useCount > 0) {
      return 'ACCEPTED';
    }
    if (!link.active || (link.expiresAt && link.expiresAt <= new Date())) {
      return 'EXPIRED';
    }
    return 'PENDING';
  }

  private async assertNoConflictingPendingInvite(
    trainerId: string,
    targetEmail: string,
  ): Promise<void> {
    const existing = (await this.prisma.shareLink.findFirst({
      where: {
        trainerId,
        targetEmail,
        type: ShareLinkType.UNIQUE,
        active: true,
        useCount: 0,
      },
      orderBy: { createdAt: 'desc' },
    })) as { expiresAt: Date | null } | null;

    if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
      throw new AppException(
        'COACH_INVITE_ALREADY_PENDING',
        'An unexpired invite already exists for this email',
        409,
      );
    }
  }

  private async createWithRetry<T>(
    attempt: () => Promise<T>,
    retriesLeft = MAX_CODE_RETRIES,
  ): Promise<T> {
    try {
      return await attempt();
    } catch (error) {
      if (isP2002(error) && retriesLeft > 0) {
        return this.createWithRetry(attempt, retriesLeft - 1);
      }
      throw error;
    }
  }

  private toCoachInviteResponse(link: {
    code: string;
    targetEmail: string | null;
    expiresAt?: Date | null;
  }): CoachInviteResponseDto {
    const dto = new CoachInviteResponseDto();
    dto.code = link.code;
    dto.url = this.buildJoinUrl(link.code);
    dto.targetEmail = link.targetEmail ?? '';
    dto.expiresAt = link.expiresAt ? link.expiresAt.toISOString() : '';
    return dto;
  }

  private buildJoinUrl(code: string): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return `${base}/join/${code}`;
  }
}

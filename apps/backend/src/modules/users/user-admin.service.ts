import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Role, UserStatus } from '../../../generated/prisma/enums';
import { PasswordResetService } from '../auth/password-reset.service';
import { DuplicateEmailException } from '../auth/exceptions/duplicate-email.exception';
import { UserSummaryDto } from '../auth/dto/user-summary.dto';
import { MappableUser, toUserSummary } from '../auth/user-summary.mapper';
import { AppException } from '../../shared/errors/app-exception';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { STORAGE_SERVICE } from '../../shared/storage/storage.service';
import type { StorageService } from '../../shared/storage/storage.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { EditUserDto } from './dto/edit-user.dto';

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CreatedTrainer {
  id: string;
  email: string;
  role: Role;
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
}

export interface ListUsersResult {
  items: UserSummaryDto[];
  total: number;
}

@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly passwordResetService: PasswordResetService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async createTrainer(dto: CreateTrainerDto): Promise<CreatedTrainer> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new DuplicateEmailException();
    }

    // A random, never-communicated password hash — the account is only
    // ever usable once the invite-setup link below is consumed. No
    // plaintext temp password is ever emailed.
    const placeholderPasswordHash = randomBytes(32).toString('hex');

    const trainer = await this.prisma.$transaction(async (tx) => {
      const createdUser = (await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: placeholderPasswordHash,
          role: Role.TRAINER,
          emailVerified: true,
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
            },
          },
        },
      })) as CreatedTrainer;

      await tx.trainerProfile.create({
        data: {
          userId: createdUser.id,
          businessName: dto.businessName,
        },
      });

      return createdUser;
    });

    const inviteToken = await this.passwordResetService.createResetToken(
      trainer.id,
      INVITE_TOKEN_TTL_MS,
    );

    await this.emailService.send({
      to: dto.email,
      subject: 'Set up your trainer account',
      body: `Welcome! Use this token to set your password and activate your account: ${inviteToken}`,
    });

    return trainer;
  }

  async listUsers(query: ListUsersQuery): Promise<ListUsersResult> {
    const filters: Record<string, unknown>[] = [];
    if (query.role) {
      filters.push({ role: query.role });
    }
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.search) {
      filters.push({
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          {
            profile: {
              firstName: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            profile: {
              lastName: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      });
    }
    const where = filters.length > 0 ? { AND: filters } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: (users as MappableUser[]).map(toUserSummary),
      total,
    };
  }

  async editUser(userId: string, dto: EditUserDto): Promise<UserSummaryDto> {
    const { businessName, ...profileFields } = dto;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileFields).length > 0) {
        await tx.profile.update({
          where: { userId },
          data: profileFields,
        });
      }
      if (businessName) {
        await tx.trainerProfile.update({
          where: { userId },
          data: { businessName },
        });
      }
    });

    const updated = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })) as MappableUser;
    return toUserSummary(updated);
  }

  async deactivateUser(userId: string): Promise<UserSummaryDto> {
    const user = await this.getUserOrThrow(userId);
    if (user.status === UserStatus.DELETED) {
      throw new AppException(
        'ACCOUNT_ALREADY_DELETED',
        'A deleted user cannot be deactivated — deletion is permanent',
        409,
      );
    }

    const updated = (await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
      include: { profile: true },
    })) as MappableUser;
    return toUserSummary(updated);
  }

  async reactivateUser(userId: string): Promise<UserSummaryDto> {
    const user = await this.getUserOrThrow(userId);
    if (user.status !== UserStatus.INACTIVE) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        'Only an INACTIVE user can be reactivated — a DELETED user can never be resurrected',
        409,
      );
    }

    const updated = (await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
      include: { profile: true },
    })) as MappableUser;
    return toUserSummary(updated);
  }

  async deleteUser(
    userId: string,
    opts: { deletedBy: string; reason?: string },
  ): Promise<void> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })) as {
      id: string;
      email: string;
      status: UserStatus;
      profile: { photoUrl: string | null } | null;
    } | null;

    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    }
    if (user.status === UserStatus.DELETED) {
      throw new AppException(
        'ACCOUNT_ALREADY_DELETED',
        'This user has already been deleted',
        409,
      );
    }

    const originalEmail = user.email;
    const photoUrl = user.profile?.photoUrl ?? null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@example.com`,
          status: UserStatus.DELETED,
        },
      }),
      this.prisma.profile.update({
        where: { userId },
        data: {
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          photoUrl: null,
        },
      }),
      this.prisma.userDeletionLog.create({
        data: {
          originalUserId: userId,
          originalEmailBackup: originalEmail,
          deletedById: opts.deletedBy,
          reason: opts.reason,
        },
      }),
    ]);

    if (photoUrl) {
      await this.storageService.delete(photoUrl);
    }
  }

  private async getUserOrThrow(
    userId: string,
  ): Promise<{ id: string; status: UserStatus }> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as { id: string; status: UserStatus } | null;
    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    }
    return user;
  }
}

import { Role, UserStatus } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { DuplicateEmailException } from '../auth/exceptions/duplicate-email.exception';
import { PasswordResetService } from '../auth/password-reset.service';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { EmailService } from '../../shared/email/email.service';
import { UserAdminService } from './user-admin.service';

interface CreateUserArgs {
  data: { email: string; role: Role };
}

describe('UserAdminService.createTrainer', () => {
  let service: UserAdminService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };
  let passwordResetService: { createResetToken: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    passwordResetService = {
      createResetToken: jest.fn().mockResolvedValue('invite-token'),
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation((args: CreateUserArgs) =>
      Promise.resolve({
        id: 'trainer-1',
        email: args.data.email,
        role: Role.TRAINER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      }),
    );
    prisma.trainerProfile.create.mockResolvedValue({ id: 'tp-1' });

    service = new UserAdminService(
      prisma as never,
      emailService as unknown as EmailService,
      passwordResetService as unknown as PasswordResetService,
    );
  });

  it('should create a TRAINER user with Profile and TrainerProfile in one transaction', async () => {
    const result = await service.createTrainer({
      businessName: 'Acme Training',
      firstName: 'A',
      lastName: 'B',
      email: 'trainer@x.com',
    });

    expect(result.role).toBe(Role.TRAINER);
    const userCreateArgs = getMockCallArg<CreateUserArgs>(prisma.user.create);
    expect(userCreateArgs.data.role).toBe(Role.TRAINER);
    expect(prisma.trainerProfile.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should issue an invite-setup link rather than a plaintext temp password', async () => {
    await service.createTrainer({
      businessName: 'Acme Training',
      firstName: 'A',
      lastName: 'B',
      email: 'trainer@x.com',
    });

    expect(passwordResetService.createResetToken).toHaveBeenCalledWith(
      'trainer-1',
      expect.any(Number),
    );
    const emailArgs = getMockCallArg<{ body: string }>(emailService.send);
    expect(emailArgs.body).toContain('invite-token');
    expect(emailArgs.body).not.toMatch(/password.{0,20}:\s*\S+/i);
  });

  it('should throw DuplicateEmailException when the email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createTrainer({
        businessName: 'Acme Training',
        firstName: 'A',
        lastName: 'B',
        email: 'trainer@x.com',
      }),
    ).rejects.toThrow(DuplicateEmailException);
  });
});

describe('UserAdminService.listUsers', () => {
  let service: UserAdminService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new UserAdminService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      { createResetToken: jest.fn() } as unknown as PasswordResetService,
    );
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
  });

  it('should paginate correctly at page boundaries', async () => {
    await service.listUsers({ page: 3, pageSize: 20 });

    const findManyArgs = getMockCallArg<{ skip: number; take: number }>(
      prisma.user.findMany,
    );
    expect(findManyArgs.skip).toBe(40);
    expect(findManyArgs.take).toBe(20);
  });

  it('should combine role + status + search filters with AND semantics', async () => {
    await service.listUsers({
      page: 1,
      pageSize: 20,
      search: 'jane',
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
    });

    const findManyArgs = getMockCallArg<{
      where: { AND: Record<string, unknown>[] };
    }>(prisma.user.findMany);
    expect(findManyArgs.where.AND).toEqual(
      expect.arrayContaining([
        { role: Role.TRAINER },
        { status: UserStatus.ACTIVE },
      ]),
    );
    const searchClause = findManyArgs.where.AND.find(
      (clause) => 'OR' in clause,
    );
    expect(searchClause).toBeDefined();
  });

  it('should return { items: [], total: 0 } for an empty result set, not an error', async () => {
    const result = await service.listUsers({ page: 1, pageSize: 20 });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('should map results to UserSummaryDto shape', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@x.com',
        role: Role.PLAYER,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        profile: { firstName: 'A', lastName: 'B' },
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.listUsers({ page: 1, pageSize: 20 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'u1', name: 'A B', email: 'a@x.com' }),
    );
    expect(result.total).toBe(1);
  });
});

describe('UserAdminService.editUser', () => {
  let service: UserAdminService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new UserAdminService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      { createResetToken: jest.fn() } as unknown as PasswordResetService,
    );
    prisma.profile.update.mockResolvedValue({ userId: 'u1' });
    prisma.trainerProfile.update.mockResolvedValue({ userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@x.com',
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      profile: { firstName: 'New', lastName: 'Name' },
    });
  });

  it('should update only Profile fields for a Profile-shaped edit', async () => {
    await service.editUser('u1', { firstName: 'New', lastName: 'Name' });

    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { firstName: 'New', lastName: 'Name' },
      }),
    );
    expect(prisma.trainerProfile.update).not.toHaveBeenCalled();
  });

  it('should update TrainerProfile.businessName when present', async () => {
    await service.editUser('u1', { businessName: 'New Biz' });

    expect(prisma.trainerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: { businessName: 'New Biz' },
      }),
    );
  });
});

describe('UserAdminService.deactivateUser / reactivateUser', () => {
  let service: UserAdminService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new UserAdminService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      { createResetToken: jest.fn() } as unknown as PasswordResetService,
    );
  });

  it('should set status = INACTIVE and touch no other table', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'a@x.com',
      role: Role.PLAYER,
      status: UserStatus.INACTIVE,
      lastLoginAt: null,
      profile: null,
    });

    await service.deactivateUser('u1');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.INACTIVE } }),
    );
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('should reject deactivating an already-DELETED user (no resurrection path)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.DELETED,
    });

    await expect(service.deactivateUser('u1')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should reactivate only from INACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.INACTIVE,
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'a@x.com',
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      profile: null,
    });

    await service.reactivateUser('u1');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.ACTIVE } }),
    );
  });

  it('should reject reactivating a DELETED user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.DELETED,
    });

    await expect(service.reactivateUser('u1')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('UserAdminService.deleteUser', () => {
  let service: UserAdminService;
  let prisma: MockPrismaService;
  let storageService: { delete: jest.Mock };
  const userId = 'user-1';
  const adminId = 'admin-1';

  beforeEach(() => {
    prisma = createMockPrismaService();
    storageService = { delete: jest.fn().mockResolvedValue(undefined) };
    service = new UserAdminService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      { createResetToken: jest.fn() } as unknown as PasswordResetService,
      storageService as never,
    );

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'real@x.com',
      status: UserStatus.ACTIVE,
      profile: { photoUrl: '/uploads/photos/user-1.png' },
    });
    prisma.user.update.mockResolvedValue({ id: userId });
    prisma.profile.update.mockResolvedValue({ userId });
    prisma.userDeletionLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('should anonymize name, email, and phone while preserving the row', async () => {
    await service.deleteUser(userId, {
      deletedBy: adminId,
      reason: 'GDPR request',
    });

    const userUpdateArgs = getMockCallArg<{
      where: { id: string };
      data: { email: string; status: UserStatus };
    }>(prisma.user.update);
    expect(userUpdateArgs.where).toEqual({ id: userId });
    expect(userUpdateArgs.data.email).toBe(`deleted_${userId}@example.com`);
    expect(userUpdateArgs.data.status).toBe(UserStatus.DELETED);

    const profileUpdateArgs = getMockCallArg<{
      data: {
        firstName: string;
        lastName: string;
        phone: null;
        photoUrl: null;
      };
    }>(prisma.profile.update);
    expect(profileUpdateArgs.data).toEqual({
      firstName: 'Deleted',
      lastName: 'User',
      phone: null,
      photoUrl: null,
    });
  });

  it('should write a UserDeletionLog with the original email backed up', async () => {
    await service.deleteUser(userId, {
      deletedBy: adminId,
      reason: 'GDPR request',
    });

    const logArgs = getMockCallArg<{
      data: {
        originalUserId: string;
        originalEmailBackup: string;
        deletedById: string;
      };
    }>(prisma.userDeletionLog.create);
    expect(logArgs.data).toEqual({
      originalUserId: userId,
      originalEmailBackup: 'real@x.com',
      deletedById: adminId,
      reason: 'GDPR request',
    });
  });

  it('should delete the stored photo file if present', async () => {
    await service.deleteUser(userId, { deletedBy: adminId });

    expect(storageService.delete).toHaveBeenCalledWith(
      '/uploads/photos/user-1.png',
    );
  });

  it('should reject re-deleting an already-DELETED user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'real@x.com',
      status: UserStatus.DELETED,
      profile: null,
    });

    await expect(
      service.deleteUser(userId, { deletedBy: adminId }),
    ).rejects.toThrow(AppException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

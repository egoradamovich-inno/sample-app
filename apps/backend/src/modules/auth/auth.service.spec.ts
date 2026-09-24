import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '../../../generated/prisma/enums';

// bcrypt.compare is a non-configurable property on the native binding, so
// jest.spyOn can't wrap it directly ("Cannot redefine property"). Re-exporting
// it as a jest.fn() around the real implementation keeps every other test in
// this file exercising real bcrypt behavior while making call counts
// assertable for the anti-timing-enumeration test below.
jest.mock('bcrypt', () => {
  const actual: typeof import('bcrypt') = jest.requireActual('bcrypt');
  return {
    ...actual,
    compare: jest.fn((data: string, encrypted: string): Promise<boolean> =>
      actual.compare(data, encrypted),
    ),
  };
});
import { EmailService } from '../../shared/email/email.service';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { AuthService } from './auth.service';
import { AccountDeactivatedException } from './exceptions/account-deactivated.exception';
import { DuplicateEmailException } from './exceptions/duplicate-email.exception';
import { EmailNotVerifiedException } from './exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { TokenService } from './token.service';

interface CreateUserArgs {
  data: {
    email: string;
    passwordHash: string;
  };
}

function createMockTokenService(): {
  issuePair: jest.Mock;
  revoke: jest.Mock;
  findActiveByRawToken: jest.Mock;
} {
  return {
    issuePair: jest
      .fn()
      .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    revoke: jest.fn().mockResolvedValue(undefined),
    findActiveByRawToken: jest.fn().mockResolvedValue(null),
  };
}

describe('AuthService.register', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };
  let capturedCreateArgs: CreateUserArgs | undefined;

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma as never,
      emailService as unknown as EmailService,
      createMockTokenService() as unknown as TokenService,
    );
    capturedCreateArgs = undefined;

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation((args: CreateUserArgs) => {
      capturedCreateArgs = args;
      return Promise.resolve({
        id: 'new-user-id',
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        role: Role.PLAYER,
        status: UserStatus.ACTIVE,
        emailVerified: false,
      });
    });
    prisma.emailVerificationToken.create.mockResolvedValue({
      id: 'token-1',
    });
  });

  it('should hash the password before storing', async () => {
    const user = await service.register({
      email: 'a@x.com',
      password: 'Passw0rd!',
      firstName: 'A',
      lastName: 'B',
    });

    expect(user.passwordHash).not.toBe('Passw0rd!');
    expect(capturedCreateArgs).toBeDefined();
    const storedHash = (capturedCreateArgs as CreateUserArgs).data.passwordHash;
    expect(await bcrypt.compare('Passw0rd!', storedHash)).toBe(true);
  });

  it('should throw DuplicateEmailException when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1' });

    await expect(
      service.register({
        email: 'a@x.com',
        password: 'x',
        firstName: 'A',
        lastName: 'B',
      }),
    ).rejects.toThrow(DuplicateEmailException);
  });

  it('should create an unverified user and issue an EmailVerificationToken', async () => {
    const user = await service.register({
      email: 'a@x.com',
      password: 'Passw0rd!',
      firstName: 'A',
      lastName: 'B',
    });

    expect(user.emailVerified).toBe(false);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
  });

  it('should send a verification email', async () => {
    await service.register({
      email: 'a@x.com',
      password: 'Passw0rd!',
      firstName: 'A',
      lastName: 'B',
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@x.com' }),
    );
  });
});

describe('AuthService.login', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let tokenService: { issuePair: jest.Mock; revoke: jest.Mock };
  let storedHash: string;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    tokenService = createMockTokenService();
    service = new AuthService(
      prisma as never,
      {
        send: jest.fn().mockResolvedValue(undefined),
      } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );
    storedHash = await bcrypt.hash('Passw0rd!', 12);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@x.com',
      passwordHash: storedHash,
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      parentUserId: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
  });

  it('should issue a token pair and update lastLoginAt for correct credentials + verified email', async () => {
    const result = await service.login({
      email: 'a@x.com',
      password: 'Passw0rd!',
    });

    expect(result.accessToken).toBe('access');
    expect(tokenService.issuePair).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('should throw EmailNotVerifiedException when the email is unverified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@x.com',
      passwordHash: storedHash,
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      emailVerified: false,
      parentUserId: null,
    });

    await expect(
      service.login({ email: 'a@x.com', password: 'Passw0rd!' }),
    ).rejects.toThrow(EmailNotVerifiedException);
  });

  it('should throw the same InvalidCredentialsException for a wrong password as for an unknown email', async () => {
    await expect(
      service.login({ email: 'a@x.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsException);

    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'unknown@x.com', password: 'whatever' }),
    ).rejects.toThrow(InvalidCredentialsException);
  });

  it('should invoke bcrypt.compare exactly once for an unknown email, same as for a known one (anti-timing-enumeration)', async () => {
    const compareMock = bcrypt.compare as jest.Mock;
    compareMock.mockClear();

    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'unknown@x.com', password: 'whatever' }),
    ).rejects.toThrow(InvalidCredentialsException);

    expect(compareMock).toHaveBeenCalledTimes(1);

    compareMock.mockClear();
    await expect(
      service.login({ email: 'a@x.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsException);

    expect(compareMock).toHaveBeenCalledTimes(1);
  });

  it('should throw AccountDeactivatedException for an INACTIVE or DELETED account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@x.com',
      passwordHash: storedHash,
      role: Role.PLAYER,
      status: UserStatus.INACTIVE,
      emailVerified: true,
      parentUserId: null,
    });

    await expect(
      service.login({ email: 'a@x.com', password: 'Passw0rd!' }),
    ).rejects.toThrow(AccountDeactivatedException);
  });
});

describe('AuthService.logout', () => {
  it('should revoke the presented refresh token', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    await service.logout('raw-refresh-token');

    expect(tokenService.revoke).toHaveBeenCalledWith('raw-refresh-token');
  });

  it('should close the open ImpersonationLog when logging out mid-impersonation', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    tokenService.findActiveByRawToken.mockResolvedValue({
      userId: 'target-1',
      impersonatedBy: 'admin-1',
    });
    prisma.impersonationLog.findFirst.mockResolvedValue({
      id: 'log-1',
      startedAt: new Date(Date.now() - 1000),
    });
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    await service.logout('raw-refresh-token');

    const updateArgs = getMockCallArg<{
      where: { id: string };
      data: { endedAt: Date };
    }>(prisma.impersonationLog.update);
    expect(updateArgs.where).toEqual({ id: 'log-1' });
    expect(updateArgs.data.endedAt).toBeInstanceOf(Date);
  });

  it('should not touch ImpersonationLog for a normal (non-impersonated) logout', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    await service.logout('raw-refresh-token');

    expect(prisma.impersonationLog.findFirst).not.toHaveBeenCalled();
  });

  it('should return impersonatedBy: null for a normal logout, so the controller clears the regular cookie pair', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    const result = await service.logout('raw-refresh-token');

    expect(result).toEqual({ impersonatedBy: null });
  });

  it('should return the admin id as impersonatedBy for a logout mid-impersonation, so the controller clears only the impersonation cookie pair', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    tokenService.findActiveByRawToken.mockResolvedValue({
      userId: 'target-1',
      impersonatedBy: 'admin-1',
    });
    prisma.impersonationLog.findFirst.mockResolvedValue({
      id: 'log-1',
      startedAt: new Date(Date.now() - 1000),
    });
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    const result = await service.logout('raw-refresh-token');

    expect(result).toEqual({ impersonatedBy: 'admin-1' });
  });
});

describe('AuthService.getMe', () => {
  it('should look up the email by userId and return the identity derived from the JWT payload', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    prisma.user.findUnique.mockResolvedValue({ email: 'a@x.com' });
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    const result = await service.getMe({
      userId: 'user-1',
      role: Role.PLAYER,
      parentUserId: null,
      impersonatedBy: undefined,
    });

    expect(result).toEqual({
      userId: 'user-1',
      email: 'a@x.com',
      role: Role.PLAYER,
      parentUserId: null,
      impersonatedBy: undefined,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { email: true },
    });
  });

  it('should carry impersonatedBy and parentUserId through from the payload', async () => {
    const prisma = createMockPrismaService();
    const tokenService = createMockTokenService();
    prisma.user.findUnique.mockResolvedValue({ email: 'child@x.com' });
    const service = new AuthService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
      tokenService as unknown as TokenService,
    );

    const result = await service.getMe({
      userId: 'target-1',
      role: Role.TRAINER,
      parentUserId: 'parent-1',
      impersonatedBy: 'admin-1',
    });

    expect(result.parentUserId).toBe('parent-1');
    expect(result.impersonatedBy).toBe('admin-1');
  });
});

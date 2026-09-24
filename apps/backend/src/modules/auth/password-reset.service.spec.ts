import * as bcrypt from 'bcrypt';
import { EmailService } from '../../shared/email/email.service';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { PasswordResetTokenExpiredException } from './exceptions/password-reset-token-expired.exception';
import { PasswordResetTokenInvalidException } from './exceptions/password-reset-token-invalid.exception';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService.request', () => {
  let service: PasswordResetService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new PasswordResetService(
      prisma as never,
      emailService as unknown as EmailService,
    );
  });

  it('should create a 1h-expiry token and email a reset link for an existing email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@x.com',
    });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'reset-1' });

    await service.request('a@x.com');

    const createArgs = getMockCallArg<{
      data: { userId: string; expiresAt: Date };
    }>(prisma.passwordResetToken.create);
    expect(createArgs.data.userId).toBe('user-1');
    const ttlMs = createArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(0.9 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@x.com' }),
    );
  });

  it('should return the same generic success response for a non-existent email, with no token created', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.request('unknown@x.com');

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.confirm', () => {
  let service: PasswordResetService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new PasswordResetService(
      prisma as never,
      {
        send: jest.fn().mockResolvedValue(undefined),
      } as unknown as EmailService,
    );
  });

  it('should update the password hash and mark the token used for a valid token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await service.confirm('valid-token', 'NewPassw0rd!');

    const updateArgs = getMockCallArg<{
      where: { id: string };
      data: { passwordHash: string };
    }>(prisma.user.update);
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(
      await bcrypt.compare('NewPassw0rd!', updateArgs.data.passwordHash),
    ).toBe(true);
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reset-1' } }),
    );
  });

  it('should throw PasswordResetTokenExpiredException for an expired or already-used token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    await expect(
      service.confirm('expired-token', 'NewPassw0rd!'),
    ).rejects.toThrow(PasswordResetTokenExpiredException);
  });

  it('should throw PasswordResetTokenInvalidException for an unknown token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(
      service.confirm('unknown-token', 'NewPassw0rd!'),
    ).rejects.toThrow(PasswordResetTokenInvalidException);
  });
});

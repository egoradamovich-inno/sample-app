import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { EmailService } from '../../shared/email/email.service';
import { VerificationTokenExpiredException } from './exceptions/verification-token-expired.exception';
import { VerificationTokenInvalidException } from './exceptions/verification-token-invalid.exception';
import { VerificationService } from './verification.service';

describe('VerificationService.verifyEmail', () => {
  let service: VerificationService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new VerificationService(
      prisma as never,
      emailService as unknown as EmailService,
    );
  });

  it('should mark the user verified and the token used for a valid unexpired token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await service.verifyEmail('valid-token');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailVerified: true },
    });
    const tokenUpdateCall = getMockCallArg<{
      where: { id: string };
      data: { usedAt: Date };
    }>(prisma.emailVerificationToken.update);
    expect(tokenUpdateCall.where).toEqual({ id: 'token-1' });
    expect(tokenUpdateCall.data.usedAt).toBeInstanceOf(Date);
  });

  it('should throw VerificationTokenExpiredException for an expired token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    });

    await expect(service.verifyEmail('expired-token')).rejects.toThrow(
      VerificationTokenExpiredException,
    );
  });

  it('should throw VerificationTokenExpiredException for an already-used token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      token: 'used-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });

    await expect(service.verifyEmail('used-token')).rejects.toThrow(
      VerificationTokenExpiredException,
    );
  });

  it('should throw VerificationTokenInvalidException for an unknown token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

    await expect(service.verifyEmail('unknown-token')).rejects.toThrow(
      VerificationTokenInvalidException,
    );
  });
});

describe('VerificationService.resendVerification', () => {
  let service: VerificationService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new VerificationService(
      prisma as never,
      emailService as unknown as EmailService,
    );
  });

  it('should create a new token and send an email for an unverified account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'unverified@x.com',
      emailVerified: false,
    });

    await service.resendVerification('unverified@x.com');

    const createArgs = getMockCallArg<{
      data: { userId: string; token: string };
    }>(prisma.emailVerificationToken.create);
    expect(createArgs.data.userId).toBe('user-1');
    expect(createArgs.data.token).toBeTruthy();
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'unverified@x.com' }),
    );
  });

  it('should silently no-op for an unknown email — no enumeration signal', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.resendVerification('unknown@x.com');

    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('should silently no-op for an already-verified account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'verified@x.com',
      emailVerified: true,
    });

    await service.resendVerification('verified@x.com');

    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

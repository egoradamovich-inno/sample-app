import { ApprovalStatus, PaymentType } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { EmailService } from '../../shared/email/email.service';
import { PurchaseApprovalService } from './purchase-approval.service';

const childProfileId = 'child-pp-1';
const parentUserId = 'parent-1';

describe('PurchaseApprovalService.createApprovalRequest', () => {
  let service: PurchaseApprovalService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new PurchaseApprovalService(
      prisma as never,
      emailService as unknown as EmailService,
    );
    prisma.playerProfile.findUnique.mockResolvedValue({
      id: childProfileId,
      parentUserId,
      tokenAutoApprove: false,
    });
    prisma.childPurchaseApproval.create.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'approval-1', ...args.data }),
    );
  });

  it('should always require approval for USD payments', async () => {
    const result = await service.createApprovalRequest({
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      amount: 20,
      paymentType: PaymentType.USD,
    });
    expect(result.status).toBe(ApprovalStatus.PENDING);
  });

  it('should require approval for token spend by default (tokenAutoApprove=false)', async () => {
    const result = await service.createApprovalRequest({
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      amount: 5,
      paymentType: PaymentType.TOKEN,
    });
    expect(result.status).toBe(ApprovalStatus.PENDING);
  });

  it('should auto-approve token spend when tokenAutoApprove=true, sending an informational notification', async () => {
    prisma.playerProfile.findUnique.mockResolvedValue({
      id: childProfileId,
      parentUserId,
      tokenAutoApprove: true,
    });
    prisma.user.findUnique.mockResolvedValue({ email: 'parent@x.com' });

    const result = await service.createApprovalRequest({
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      amount: 5,
      paymentType: PaymentType.TOKEN,
    });

    expect(result.status).toBe(ApprovalStatus.APPROVED);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('processed') as string,
      }),
    );
  });

  it('should set expiresAt 48 hours out', async () => {
    const result = await service.createApprovalRequest({
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      amount: 20,
      paymentType: PaymentType.USD,
    });

    const createArgs = getMockCallArg<{
      data: { requestedAt: Date; expiresAt: Date };
    }>(prisma.childPurchaseApproval.create);
    const diffMs =
      createArgs.data.expiresAt.getTime() -
      createArgs.data.requestedAt.getTime();
    expect(diffMs).toBe(48 * 60 * 60 * 1000);
    expect(result.id).toBe('approval-1');
  });
});

describe('PurchaseApprovalService.listForParent', () => {
  let service: PurchaseApprovalService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new PurchaseApprovalService(
      prisma as never,
      { send: jest.fn() } as unknown as EmailService,
    );
  });

  it('should lazily flip an overdue PENDING request to EXPIRED on read', async () => {
    prisma.childPurchaseApproval.findMany.mockResolvedValue([
      {
        id: 'approval-1',
        childProfileId,
        parentUserId,
        eventOrPurchaseRef: 'event-1',
        amount: 20,
        paymentType: PaymentType.USD,
        status: ApprovalStatus.PENDING,
        requestedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        childProfile: { displayName: 'Alex' },
      },
    ]);
    prisma.childPurchaseApproval.update.mockResolvedValue({
      id: 'approval-1',
      childProfileId,
      parentUserId,
      eventOrPurchaseRef: 'event-1',
      amount: 20,
      paymentType: PaymentType.USD,
      status: ApprovalStatus.EXPIRED,
      requestedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      childProfile: { displayName: 'Alex' },
    });

    const result = await service.listForParent(parentUserId);

    const updateArgs = getMockCallArg<{
      where: { id: string };
      data: { status: ApprovalStatus };
    }>(prisma.childPurchaseApproval.update);
    expect(updateArgs.where).toEqual({ id: 'approval-1' });
    expect(updateArgs.data.status).toBe(ApprovalStatus.EXPIRED);
    expect(result[0].status).toBe(ApprovalStatus.EXPIRED);
    expect(result[0].isExpired).toBe(true);
  });

  it('should not touch a PENDING request still within its window', async () => {
    prisma.childPurchaseApproval.findMany.mockResolvedValue([
      {
        id: 'approval-1',
        childProfileId,
        parentUserId,
        eventOrPurchaseRef: 'event-1',
        amount: 20,
        paymentType: PaymentType.USD,
        status: ApprovalStatus.PENDING,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        childProfile: { displayName: 'Alex' },
      },
    ]);

    const result = await service.listForParent(parentUserId);

    expect(prisma.childPurchaseApproval.update).not.toHaveBeenCalled();
    expect(result[0].isExpired).toBe(false);
  });
});

describe('PurchaseApprovalService.approve / deny', () => {
  let service: PurchaseApprovalService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new PurchaseApprovalService(
      prisma as never,
      emailService as unknown as EmailService,
    );
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.PENDING,
      childProfileId,
      expiresAt: new Date(Date.now() + 1000),
      childProfile: { displayName: 'Alex' },
    });
    prisma.childPurchaseApproval.update.mockImplementation(
      (args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          id: args.where.id,
          parentUserId,
          childProfileId,
          eventOrPurchaseRef: 'event-1',
          amount: 20,
          paymentType: PaymentType.USD,
          requestedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000),
          childProfile: { displayName: 'Alex' },
          ...args.data,
        }),
    );
  });

  it('should approve a PENDING request belonging to the caller', async () => {
    const result = await service.approve('approval-1', parentUserId);
    expect(result.status).toBe(ApprovalStatus.APPROVED);
  });

  it('should reject approving when the caller is not the parent on the request', async () => {
    await expect(
      service.approve('approval-1', 'someone-else'),
    ).rejects.toThrow();
  });

  it('should reject approving an already-resolved request', async () => {
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.APPROVED,
      childProfileId,
      expiresAt: new Date(Date.now() + 1000),
      childProfile: { displayName: 'Alex' },
    });
    await expect(service.approve('approval-1', parentUserId)).rejects.toThrow();
  });

  it('should deny with parentNotes and notify the child', async () => {
    const result = await service.deny('approval-1', parentUserId, {
      parentNotes: 'Not this time',
    });
    expect(result.status).toBe(ApprovalStatus.DENIED);
  });

  it('should reject approving a request that is still PENDING but past expiresAt, flipping it to EXPIRED instead', async () => {
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.PENDING,
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      expiresAt: new Date(Date.now() - 1000),
      childProfile: { displayName: 'Alex' },
    });
    prisma.playerProfile.findUnique.mockResolvedValue({
      user: { email: 'child@x.com' },
    });

    await expect(service.approve('approval-1', parentUserId)).rejects.toThrow(
      'This request has expired',
    );

    const updateArgs = getMockCallArg<{
      where: { id: string };
      data: { status: ApprovalStatus };
    }>(prisma.childPurchaseApproval.update);
    expect(updateArgs.where).toEqual({ id: 'approval-1' });
    expect(updateArgs.data.status).toBe(ApprovalStatus.EXPIRED);
  });

  it('should reject denying a request that is still PENDING but past expiresAt', async () => {
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.PENDING,
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      expiresAt: new Date(Date.now() - 1000),
      childProfile: { displayName: 'Alex' },
    });
    prisma.playerProfile.findUnique.mockResolvedValue({
      user: { email: 'child@x.com' },
    });

    await expect(
      service.deny('approval-1', parentUserId, { parentNotes: 'too late' }),
    ).rejects.toThrow('This request has expired');
  });

  it('should notify the child (their own account email) when a request auto-expires', async () => {
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.PENDING,
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      expiresAt: new Date(Date.now() - 1000),
      childProfile: { displayName: 'Alex' },
    });
    prisma.playerProfile.findUnique.mockResolvedValue({
      user: { email: 'child@x.com' },
    });

    await expect(service.approve('approval-1', parentUserId)).rejects.toThrow();

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'child@x.com',
        subject: expect.stringContaining('expired') as string,
      }),
    );
  });

  it('should fall back to notifying the parent when the child has no login account of their own', async () => {
    prisma.childPurchaseApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      parentUserId,
      status: ApprovalStatus.PENDING,
      childProfileId,
      eventOrPurchaseRef: 'event-1',
      expiresAt: new Date(Date.now() - 1000),
      childProfile: { displayName: 'Alex' },
    });
    prisma.playerProfile.findUnique.mockResolvedValue({ user: null });
    prisma.user.findUnique.mockResolvedValue({ email: 'parent@x.com' });

    await expect(service.approve('approval-1', parentUserId)).rejects.toThrow();

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@x.com' }),
    );
  });
});

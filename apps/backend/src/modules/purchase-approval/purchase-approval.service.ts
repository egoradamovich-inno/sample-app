import { Injectable } from '@nestjs/common';
import { ApprovalStatus, PaymentType } from '../../../generated/prisma/enums';
import { AppException } from '../../shared/errors/app-exception';
import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DenyApprovalDto } from './dto/deny-approval.dto';
import { PurchaseApprovalDto } from './dto/purchase-approval.dto';

const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;

export interface CreateApprovalRequestInput {
  childProfileId: string;
  eventOrPurchaseRef: string;
  amount: number;
  paymentType: PaymentType;
}

interface ApprovalRow {
  id: string;
  childProfileId: string;
  parentUserId: string;
  eventOrPurchaseRef: string;
  amount: unknown;
  paymentType: PaymentType;
  status: ApprovalStatus;
  requestedAt: Date;
  expiresAt: Date;
  childProfile: { displayName: string } | null;
}

@Injectable()
export class PurchaseApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createApprovalRequest(
    input: CreateApprovalRequestInput,
  ): Promise<PurchaseApprovalDto> {
    const child = (await this.prisma.playerProfile.findUnique({
      where: { id: input.childProfileId },
    })) as {
      id: string;
      parentUserId: string;
      tokenAutoApprove: boolean;
    } | null;

    if (!child) {
      throw new AppException(
        'PLAYER_PROFILE_NOT_FOUND',
        'Child profile not found',
        404,
      );
    }

    // USD always requires approval; TOKEN checks the per-child setting —
    // the one place that setting is ever consulted.
    const autoApprove =
      input.paymentType === PaymentType.TOKEN && child.tokenAutoApprove;

    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + APPROVAL_TTL_MS);

    const created = (await this.prisma.childPurchaseApproval.create({
      data: {
        childProfileId: input.childProfileId,
        parentUserId: child.parentUserId,
        eventOrPurchaseRef: input.eventOrPurchaseRef,
        amount: input.amount,
        paymentType: input.paymentType,
        status: autoApprove ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
        requestedAt,
        expiresAt,
        respondedAt: autoApprove ? requestedAt : undefined,
      },
      include: { childProfile: true },
    })) as ApprovalRow;

    if (autoApprove) {
      const parent = (await this.prisma.user.findUnique({
        where: { id: child.parentUserId },
      })) as { email: string } | null;
      if (parent) {
        await this.emailService.send({
          to: parent.email,
          subject: 'Token purchase processed',
          body: `Your child's token purchase was processed automatically per your settings.`,
        });
      }
    }

    return this.toDto(created);
  }

  async listForParent(parentUserId: string): Promise<PurchaseApprovalDto[]> {
    const rows = (await this.prisma.childPurchaseApproval.findMany({
      where: { parentUserId },
      include: { childProfile: true },
      orderBy: { requestedAt: 'desc' },
    })) as ApprovalRow[];

    const results: PurchaseApprovalDto[] = [];
    for (const row of rows) {
      const current = await this.expireIfStale(row);
      results.push(this.toDto(current));
    }

    return results;
  }

  async approve(
    id: string,
    parentUserId: string,
  ): Promise<PurchaseApprovalDto> {
    await this.assertOwnedAndPending(id, parentUserId);
    const updated = (await this.prisma.childPurchaseApproval.update({
      where: { id },
      data: { status: ApprovalStatus.APPROVED, respondedAt: new Date() },
      include: { childProfile: true },
    })) as ApprovalRow;
    return this.toDto(updated);
  }

  async deny(
    id: string,
    parentUserId: string,
    dto: DenyApprovalDto,
  ): Promise<PurchaseApprovalDto> {
    await this.assertOwnedAndPending(id, parentUserId);
    const updated = (await this.prisma.childPurchaseApproval.update({
      where: { id },
      data: {
        status: ApprovalStatus.DENIED,
        respondedAt: new Date(),
        parentNotes: dto.parentNotes,
      },
      include: { childProfile: true },
    })) as ApprovalRow;
    return this.toDto(updated);
  }

  /**
   * Lazy-expiry check shared by every read/mutation path (no scheduler, per
   * this project's convention for all expiry — see F4 plan notes). Flips an
   * overdue PENDING row to EXPIRED, fires the child-notification side
   * effect exactly once (on the transition), and returns the row the caller
   * should actually act on.
   */
  private async expireIfStale(row: ApprovalRow): Promise<ApprovalRow> {
    const now = new Date();
    if (row.status !== ApprovalStatus.PENDING || row.expiresAt > now) {
      return row;
    }

    const updated = (await this.prisma.childPurchaseApproval.update({
      where: { id: row.id },
      data: { status: ApprovalStatus.EXPIRED, respondedAt: now },
      include: { childProfile: true },
    })) as ApprovalRow;

    await this.notifyOfExpiry(row);

    return updated;
  }

  private async notifyOfExpiry(row: ApprovalRow): Promise<void> {
    // Prefer the child's own account email when the child has independent
    // login (see F3 child-login provisioning); most children in this app
    // have no such account, so fall back to the parent — who is the only
    // reachable contact in that case and still needs to know the request
    // lapsed unanswered.
    const child = (await this.prisma.playerProfile.findUnique({
      where: { id: row.childProfileId },
      include: { user: true },
    })) as { user: { email: string } | null } | null;

    let recipientEmail = child?.user?.email;
    if (!recipientEmail) {
      const parent = (await this.prisma.user.findUnique({
        where: { id: row.parentUserId },
      })) as { email: string } | null;
      recipientEmail = parent?.email;
    }

    if (!recipientEmail) {
      return;
    }

    await this.emailService.send({
      to: recipientEmail,
      subject: 'Purchase request expired',
      body: `The request for "${row.eventOrPurchaseRef}" was not answered in time and has automatically expired.`,
    });
  }

  private async assertOwnedAndPending(
    id: string,
    parentUserId: string,
  ): Promise<void> {
    const existing = (await this.prisma.childPurchaseApproval.findUnique({
      where: { id },
      include: { childProfile: true },
    })) as ApprovalRow | null;

    if (!existing || existing.parentUserId !== parentUserId) {
      throw new AppException(
        'APPROVAL_NOT_FOUND',
        'This request was not found',
        404,
      );
    }

    const current = await this.expireIfStale(existing);

    if (current.status === ApprovalStatus.EXPIRED) {
      throw new AppException(
        'APPROVAL_EXPIRED',
        'This request has expired and can no longer be approved or denied',
        409,
      );
    }

    if (current.status !== ApprovalStatus.PENDING) {
      throw new AppException(
        'APPROVAL_ALREADY_RESOLVED',
        'This request has already been resolved',
        409,
      );
    }
  }

  private toDto(row: ApprovalRow): PurchaseApprovalDto {
    const dto = new PurchaseApprovalDto();
    dto.id = row.id;
    dto.childProfileId = row.childProfileId;
    dto.childName = row.childProfile?.displayName ?? 'Child';
    dto.parentUserId = row.parentUserId;
    dto.eventOrPurchaseRef = row.eventOrPurchaseRef;
    dto.amount = Number(row.amount);
    dto.paymentType = row.paymentType;
    dto.status = row.status;
    dto.isExpired =
      row.status === ApprovalStatus.EXPIRED ||
      (row.status === ApprovalStatus.PENDING && row.expiresAt <= new Date());
    dto.requestedAt = row.requestedAt.toISOString();
    dto.expiresAt = row.expiresAt.toISOString();
    return dto;
  }
}

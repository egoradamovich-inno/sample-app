import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  ApprovalStatus,
  PaymentType,
} from '../../../../generated/prisma/enums';

export class PurchaseApprovalDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() childProfileId: string;
  @ApiProperty() @Expose() childName: string;
  @ApiProperty() @Expose() parentUserId: string;
  @ApiProperty() @Expose() eventOrPurchaseRef: string;
  @ApiProperty() @Expose() amount: number;
  @ApiProperty({ enum: PaymentType }) @Expose() paymentType: PaymentType;
  @ApiProperty({ enum: ApprovalStatus }) @Expose() status: ApprovalStatus;
  @ApiProperty() @Expose() isExpired: boolean;
  @ApiProperty() @Expose() requestedAt: string;
  @ApiProperty() @Expose() expiresAt: string;
}

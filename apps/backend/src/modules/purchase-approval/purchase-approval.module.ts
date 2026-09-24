import { Module } from '@nestjs/common';
import { EmailModule } from '../../shared/email/email.module';
import { PurchaseApprovalController } from './purchase-approval.controller';
import { PurchaseApprovalService } from './purchase-approval.service';

@Module({
  imports: [EmailModule],
  controllers: [PurchaseApprovalController],
  providers: [PurchaseApprovalService],
  exports: [PurchaseApprovalService],
})
export class PurchaseApprovalModule {}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DenyApprovalDto } from './dto/deny-approval.dto';
import { PurchaseApprovalDto } from './dto/purchase-approval.dto';
import { PurchaseApprovalService } from './purchase-approval.service';

@ApiTags('purchase-approvals')
@Controller('purchase-approvals')
export class PurchaseApprovalController {
  constructor(
    private readonly purchaseApprovalService: PurchaseApprovalService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseApprovalDto[]> {
    return this.purchaseApprovalService.listForParent(user.userId);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PurchaseApprovalDto> {
    return this.purchaseApprovalService.approve(id, user.userId);
  }

  @Post(':id/deny')
  async deny(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DenyApprovalDto,
  ): Promise<PurchaseApprovalDto> {
    return this.purchaseApprovalService.deny(id, user.userId, dto);
  }
}

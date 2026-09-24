import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CoachInviteDto } from './dto/coach-invite.dto';
import { CoachInviteListItemDto } from './dto/coach-invite-list-item.dto';
import { CoachInviteResponseDto } from './dto/coach-invite-response.dto';
import { StaticLinkResponseDto } from './dto/static-link-response.dto';
import { ShareLinkService } from './sharelink.service';

@ApiTags('sharelinks')
@Controller('sharelinks')
@Roles(Role.TRAINER)
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  @Post('static')
  async generateStatic(
    @CurrentUser() trainer: AuthenticatedUser,
  ): Promise<StaticLinkResponseDto> {
    return this.shareLinkService.generateStaticLink(
      trainer.userId,
      trainer.userId,
    );
  }

  @Post('coach-invite')
  async generateCoachInvite(
    @CurrentUser() trainer: AuthenticatedUser,
    @Body() dto: CoachInviteDto,
  ): Promise<CoachInviteResponseDto> {
    return this.shareLinkService.generateCoachInvite(
      trainer.userId,
      trainer.userId,
      dto.targetEmail,
    );
  }

  @Get('coach-invites')
  async listCoachInvites(
    @CurrentUser() trainer: AuthenticatedUser,
  ): Promise<CoachInviteListItemDto[]> {
    return this.shareLinkService.listCoachInvites(trainer.userId);
  }

  @Post('coach-invite/:id/resend')
  async resendCoachInvite(
    @CurrentUser() trainer: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CoachInviteResponseDto> {
    return this.shareLinkService.resendInvite(trainer.userId, id);
  }
}

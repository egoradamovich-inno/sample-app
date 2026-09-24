import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CoachInviteAcceptService } from './coach-invite-accept.service';
import { AcceptCoachInviteDto } from './dto/accept-coach-invite.dto';
import { RegisterViaLinkResult } from './player-registration.service';

/**
 * Same @Public() + OptionalJwtAuthGuard shape as PlayerRegistrationController
 * — a brand-new coach is anonymous; an existing account re-accepting (or
 * accepting a first invite while already logged in) is authenticated.
 */
@ApiTags('join')
@Controller('join')
@Public()
@UseGuards(OptionalJwtAuthGuard)
export class CoachInviteAcceptController {
  constructor(
    private readonly coachInviteAcceptService: CoachInviteAcceptService,
  ) {}

  @Post(':code/accept-coach')
  async acceptCoach(
    @Param('code') code: string,
    @Body() dto: AcceptCoachInviteDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ): Promise<RegisterViaLinkResult> {
    return this.coachInviteAcceptService.acceptInvite(code, dto, currentUser);
  }
}

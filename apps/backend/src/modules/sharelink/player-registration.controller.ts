import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { setAuthCookies } from '../../shared/cookies/auth-cookies.util';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { JoinLinkInfoDto } from './dto/join-link-info.dto';
import { RegisterViaLinkDto } from './dto/register-via-link.dto';
import {
  PlayerRegistrationService,
  RegisterViaLinkResult,
} from './player-registration.service';

/**
 * @Public() (skips the global JwtAuthGuard entirely) + an explicit
 * OptionalJwtAuthGuard so req.user is populated when a valid token IS
 * present, without ever rejecting an anonymous caller — this endpoint must
 * serve both a brand-new registrant and an already-logged-in parent doing
 * family selection.
 */
@ApiTags('join')
@Controller('join')
@Public()
@UseGuards(OptionalJwtAuthGuard)
export class PlayerRegistrationController {
  constructor(
    private readonly playerRegistrationService: PlayerRegistrationService,
  ) {}

  @Get(':code')
  async resolve(
    @Param('code') code: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ): Promise<JoinLinkInfoDto> {
    return this.playerRegistrationService.resolveLink(code, currentUser);
  }

  @Post(':code/register')
  async register(
    @Param('code') code: string,
    @Body() dto: RegisterViaLinkDto,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ): Promise<RegisterViaLinkResult> {
    const result = await this.playerRegistrationService.registerViaLink(
      code,
      dto,
      currentUser,
    );
    // Both branches (brand-new registrant and an already-logged-in parent
    // associating family members) issue a fresh, valid token pair for the
    // caller's own identity — setting cookies here is what actually
    // establishes the browser session for a new registrant, and is a
    // harmless no-op refresh of the existing session for the already-logged-in
    // case.
    setAuthCookies(res, result);
    return result;
  }
}

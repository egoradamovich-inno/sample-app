import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CoachAvailabilityOverrideService } from './coach-availability-override.service';
import { CoachProfileService } from './coach-profile.service';
import {
  ConflictCheckDto,
  OverrideConflictDto,
} from './dto/conflict-check.dto';
import {
  CoachProfileDto,
  PublicCoachProfileDto,
  UpdateCoachProfileDto,
} from './dto/coach-profile.dto';

@ApiTags('coach')
@Controller('coach')
export class CoachProfileController {
  constructor(
    private readonly coachProfileService: CoachProfileService,
    private readonly overrideService: CoachAvailabilityOverrideService,
  ) {}

  @Roles(Role.COACH)
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCoachProfileDto,
  ): Promise<CoachProfileDto> {
    return this.coachProfileService.updateProfile(user.userId, dto);
  }

  @Public()
  @Get('public/:slug')
  async getPublicProfile(
    @Param('slug') slug: string,
  ): Promise<PublicCoachProfileDto> {
    return this.coachProfileService.getPublicProfile(slug);
  }

  @Roles(Role.TRAINER)
  @Post(':coachId/conflict-check')
  @HttpCode(HttpStatus.OK)
  async checkConflict(
    @Param('coachId') coachId: string,
    @Body() dto: ConflictCheckDto,
  ): Promise<{ conflict: boolean }> {
    return this.overrideService.checkConflict(coachId, dto);
  }

  @Roles(Role.TRAINER)
  @Post(':coachId/override')
  @HttpCode(HttpStatus.CREATED)
  async recordOverride(
    @CurrentUser() trainer: AuthenticatedUser,
    @Param('coachId') coachId: string,
    @Body() dto: OverrideConflictDto,
  ): Promise<void> {
    await this.overrideService.recordOverride(
      coachId,
      trainer.userId,
      trainer.userId,
      dto,
    );
  }
}

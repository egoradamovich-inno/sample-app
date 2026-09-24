import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AvailabilityService } from './availability.service';
import {
  AvailabilitySlotDto,
  SetAvailabilityDto,
} from './dto/availability-slot.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('me')
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ownerProfileId') ownerProfileId?: string,
  ): Promise<AvailabilitySlotDto[]> {
    return this.availabilityService.getMine(user, ownerProfileId);
  }

  @Put('me')
  async setMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetAvailabilityDto,
  ): Promise<AvailabilitySlotDto[]> {
    return this.availabilityService.setMine(user, dto);
  }

  @Roles(Role.TRAINER)
  @Get('player/:playerId')
  async getForPlayer(
    @CurrentUser() trainer: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ): Promise<AvailabilitySlotDto[]> {
    return this.availabilityService.getForPlayerAsTrainer(
      trainer.userId,
      playerId,
    );
  }
}

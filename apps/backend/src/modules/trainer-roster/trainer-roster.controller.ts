import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedRosterDto, RosterMemberDto } from './dto/roster-member.dto';
import { TrainerRosterService } from './trainer-roster.service';

@ApiTags('trainer')
@Controller('trainer')
@Roles(Role.TRAINER)
export class TrainerRosterController {
  constructor(private readonly trainerRosterService: TrainerRosterService) {}

  @Get('roster')
  async roster(
    @CurrentUser() trainer: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<PaginatedRosterDto> {
    return this.trainerRosterService.listOwnRoster(
      trainer.userId,
      page,
      pageSize,
    );
  }

  @Get('players/availability')
  async availability(
    @CurrentUser() trainer: AuthenticatedUser,
    @Query('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Query('time') time: string,
  ): Promise<RosterMemberDto[]> {
    return this.trainerRosterService.filterByAvailability(
      trainer.userId,
      dayOfWeek,
      time,
    );
  }
}

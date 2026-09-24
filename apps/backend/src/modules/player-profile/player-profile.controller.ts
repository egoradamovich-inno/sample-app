import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BlockChildAccounts } from '../../shared/decorators/block-child-accounts.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  ChildAccountService,
  ProvisionChildLoginResult,
} from './child-account.service';
import { AddTrainerAssociationDto } from './dto/add-trainer-association.dto';
import { CreateChildProfileDto } from './dto/create-child-profile.dto';
import {
  CreateChildProfileResponseDto,
  PlayerProfileSummaryDto,
} from './dto/player-profile-summary.dto';
import { ProvisionChildLoginDto } from './dto/provision-child-login.dto';
import { PlayerProfileService } from './player-profile.service';
import {
  RemoveAssociationResult,
  TrainerAssociationService,
} from './trainer-association.service';

@ApiTags('players')
@Controller('players')
export class PlayerProfileController {
  constructor(
    private readonly playerProfileService: PlayerProfileService,
    private readonly trainerAssociationService: TrainerAssociationService,
    private readonly childAccountService: ChildAccountService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlayerProfileSummaryDto[]> {
    return this.playerProfileService.listOwnFamily(user.userId);
  }

  @BlockChildAccounts()
  @Post('child')
  @HttpCode(HttpStatus.CREATED)
  async createChild(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChildProfileDto,
  ): Promise<CreateChildProfileResponseDto> {
    return this.playerProfileService.createChildProfile(
      user.userId,
      dto,
      Boolean(user.parentUserId),
    );
  }

  @BlockChildAccounts()
  @Post(':id/trainers')
  async addTrainer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') playerProfileId: string,
    @Body() dto: AddTrainerAssociationDto,
  ): Promise<PlayerProfileSummaryDto> {
    return this.trainerAssociationService.addTrainerAssociation(
      user.userId,
      playerProfileId,
      dto,
      Boolean(user.parentUserId),
    );
  }

  @BlockChildAccounts()
  @Delete(':id/trainers/:trainerId')
  async removeTrainer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') playerProfileId: string,
    @Param('trainerId') trainerId: string,
  ): Promise<RemoveAssociationResult> {
    return this.trainerAssociationService.removeTrainerAssociation(
      user.userId,
      playerProfileId,
      trainerId,
      Boolean(user.parentUserId),
    );
  }

  @BlockChildAccounts()
  @Post(':id/child-login')
  @HttpCode(HttpStatus.CREATED)
  async provisionChildLogin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') childProfileId: string,
    @Body() dto: ProvisionChildLoginDto,
  ): Promise<ProvisionChildLoginResult> {
    return this.childAccountService.provisionChildLogin(
      user.userId,
      childProfileId,
      dto,
      Boolean(user.parentUserId),
    );
  }
}

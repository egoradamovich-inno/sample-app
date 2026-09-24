import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserSummaryDto } from '../auth/dto/user-summary.dto';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListUsersResult, UserAdminService } from './user-admin.service';

@ApiTags('admin/users')
@Controller('admin/users')
@Roles(Role.SUPER_ADMIN)
export class UserAdminController {
  constructor(private readonly userAdminService: UserAdminService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTrainer(
    @Body() dto: CreateTrainerDto,
  ): Promise<{ id: string; email: string; role: string }> {
    return this.userAdminService.createTrainer(dto);
  }

  @Get()
  async listUsers(@Query() query: ListUsersQueryDto): Promise<ListUsersResult> {
    return this.userAdminService.listUsers(query);
  }

  @Patch(':id')
  async editUser(
    @Param('id') id: string,
    @Body() dto: EditUserDto,
  ): Promise<UserSummaryDto> {
    return this.userAdminService.editUser(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateUser(@Param('id') id: string): Promise<UserSummaryDto> {
    return this.userAdminService.deactivateUser(id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateUser(@Param('id') id: string): Promise<UserSummaryDto> {
    return this.userAdminService.reactivateUser(id);
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @Body() dto: DeleteUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.userAdminService.deleteUser(id, {
      deletedBy: admin.userId,
      reason: dto.reason,
    });
    return { deleted: true };
  }
}

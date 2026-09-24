import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '../../../generated/prisma/enums';
import {
  clearImpersonationCookies,
  setImpersonationCookies,
} from '../../shared/cookies/auth-cookies.util';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ImpersonationHistoryQueryDto } from './dto/impersonation-history-query.dto';
import { ImpersonationHistoryResponseDto } from './dto/impersonation-log-entry.dto';
import { ImpersonationStartResponseDto } from './dto/impersonation-start-response.dto';
import { ImpersonationService } from './impersonation.service';

@ApiTags('admin/impersonation')
@Controller('admin/impersonation')
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  // SUPER_ADMIN-only, applied per-method (not at the controller level): the
  // /exit route below is called by the impersonated session's own token,
  // whose role is the TARGET's role, not SUPER_ADMIN — a class-level guard
  // would lock the admin out of ever exiting.
  @Roles(Role.SUPER_ADMIN)
  @Post(':userId/start')
  @HttpCode(HttpStatus.OK)
  async start(
    @Param('userId') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ImpersonationStartResponseDto> {
    const result = await this.impersonationService.start(admin.userId, userId);
    // A *second*, independent cookie pair — never touches the admin's own
    // access_token/refresh_token cookies, so their real session survives
    // underneath, untouched, for the whole impersonation lifetime.
    setImpersonationCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Post('exit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async exit(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // Harmless no-op for a non-impersonating caller — this only ever closes
    // the caller's own admin/target log pair, never anyone else's.
    if (!user.impersonatedBy) {
      return;
    }
    await this.impersonationService.exit(user.impersonatedBy, user.userId);
    // Clears only the impersonation_* pair — the admin's real access_token/
    // refresh_token cookies were never touched, so requests naturally fall
    // back to them afterward with no separate "restore" step needed.
    clearImpersonationCookies(res);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('history')
  async history(
    @Query() query: ImpersonationHistoryQueryDto,
  ): Promise<ImpersonationHistoryResponseDto> {
    return this.impersonationService.history(query);
  }
}

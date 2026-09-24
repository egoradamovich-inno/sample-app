import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BrandingService } from './branding.service';
import { BrandingDto, UpdateBrandingDto } from './dto/branding.dto';
import { LogoPayloadTooLargeFilter } from './filters/logo-payload-too-large.filter';

const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;

@ApiTags('trainer/branding')
@Controller('trainer/branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query('trainerId') trainerId?: string,
  ): Promise<BrandingDto> {
    const resolvedTrainerId =
      await this.brandingService.resolveTrainerIdForCaller(user, trainerId);
    return this.brandingService.getBranding(resolvedTrainerId);
  }

  @Roles(Role.TRAINER)
  @Put()
  async update(
    @CurrentUser() trainer: AuthenticatedUser,
    @Body() dto: UpdateBrandingDto,
  ): Promise<BrandingDto> {
    return this.brandingService.updateBranding(trainer.userId, dto);
  }

  @Roles(Role.TRAINER)
  @Post('logo')
  @ApiConsumes('multipart/form-data')
  @UseFilters(LogoPayloadTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: MAX_LOGO_UPLOAD_BYTES },
    }),
  )
  async uploadLogo(
    @CurrentUser() trainer: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BrandingDto> {
    return this.brandingService.uploadLogo(trainer.userId, file.buffer);
  }
}

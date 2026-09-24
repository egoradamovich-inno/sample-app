import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../shared/decorators/public.decorator';
import { AppException } from '../../shared/errors/app-exception';
import { CampConversionService } from './camp-conversion.service';
import {
  CampPrefillDraftDto,
  CampPrefillDraftResponseDto,
} from './dto/camp-prefill-draft.dto';

@ApiTags('camp-conversion')
@Controller('camp-conversion')
@Public()
export class CampConversionController {
  constructor(private readonly campConversionService: CampConversionService) {}

  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  // Tighter than the global default (100/60s) — this is an unauthenticated
  // endpoint backing an in-memory store, so it's a more attractive flood
  // target than most @Public() routes.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createDraft(@Body() dto: CampPrefillDraftDto): CampPrefillDraftResponseDto {
    return this.campConversionService.createPrefillDraft(dto);
  }

  @Get('draft/:token')
  getDraft(@Param('token') token: string): CampPrefillDraftDto {
    const draft = this.campConversionService.getDraft(token);
    if (!draft) {
      throw new AppException(
        'DRAFT_NOT_FOUND',
        'This registration draft was not found or has expired',
        404,
      );
    }
    return draft;
  }
}

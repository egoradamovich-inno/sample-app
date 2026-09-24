import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AddTrainerAssociationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shareLinkCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trainerId?: string;
}

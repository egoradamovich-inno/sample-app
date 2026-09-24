import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MaxLength } from 'class-validator';

export class DeleteUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

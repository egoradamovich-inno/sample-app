import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MaxLength } from 'class-validator';

export class DenyApprovalDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(500) parentNotes?: string;
}

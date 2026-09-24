import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

export class CoachInviteDto {
  @ApiProperty() @IsEmail() targetEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}

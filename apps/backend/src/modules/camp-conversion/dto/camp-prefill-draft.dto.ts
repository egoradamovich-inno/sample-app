import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CampPrefillDraftDto {
  @ApiProperty() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() trainerId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() playerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() playerBirthDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() playerGender?: string;
}

export class CampPrefillDraftResponseDto {
  @ApiProperty() @Expose() draftToken: string;
  @ApiProperty() @Expose() expiresAt: string;
}

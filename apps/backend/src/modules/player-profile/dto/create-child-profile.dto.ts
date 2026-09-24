import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateChildProfileDto {
  @ApiProperty() @IsNotEmpty() @MaxLength(100) displayName: string;
  @ApiProperty() @IsDateString() birthDate: string;
  @ApiProperty() @IsString() gender: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(200) school?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  associateTrainerIds?: string[];
}

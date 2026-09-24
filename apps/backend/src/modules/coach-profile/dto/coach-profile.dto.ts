import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCoachProfileDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(500) credentials?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() publicVisible?: boolean;
}

export class CoachProfileDto {
  @ApiPropertyOptional({ nullable: true }) @Expose() bio: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() credentials: string | null;
  @ApiProperty({ type: [String] }) @Expose() certifications: string[];
  @ApiProperty() @Expose() publicVisible: boolean;
  @ApiPropertyOptional({ nullable: true }) @Expose() publicSlug: string | null;
}

export class PublicCoachProfileDto {
  @ApiProperty() @Expose() name: string;
  @ApiPropertyOptional({ nullable: true }) @Expose() bio: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() credentials: string | null;
  @ApiProperty({ type: [String] }) @Expose() certifications: string[];
}

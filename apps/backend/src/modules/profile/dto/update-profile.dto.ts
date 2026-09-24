import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Deliberately excludes email, role, skillLevel, createdAt — combined with
 * the app-wide ValidationPipe's { whitelist: true, forbidNonWhitelisted:
 * true }, sending any of those fields is a 400, not a silently-ignored
 * no-op, per US-01.11's "read-only" fields.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @MaxLength(200) school?: string;

  // Role-specific — only the fields matching the caller's own role are
  // ever written; ProfileService silently ignores the rest rather than
  // rejecting them (a Player sending businessName has nothing to gain by
  // being told "no", it's just not applicable to them).
  @ApiPropertyOptional() @IsOptional() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(500) credentials?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() publicVisible?: boolean;

  @ApiPropertyOptional() @IsOptional() @MaxLength(20) jerseyNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(500)
  emergencyContact?: string;

  @ApiPropertyOptional() @IsOptional() @MaxLength(200) businessName?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(300) website?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(2000) description?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Serves two distinct call shapes on the same endpoint (matches the real
 * frontend contract): a brand-new anonymous registrant fills
 * email/password/firstName/lastName; an already-authenticated caller doing
 * family selection sends only associateMemberIds ('self' + child
 * PlayerProfile ids), leaving the rest blank. Both are optional at the DTO
 * level — PlayerRegistrationService enforces which combination is valid for
 * the resolved caller (new vs. existing).
 */
export class RegisterViaLinkDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional() @IsOptional() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  associateMemberIds?: string[];
}

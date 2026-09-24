import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, MaxLength, MinLength } from 'class-validator';

/**
 * Same two-shape pattern as RegisterViaLinkDto: a brand-new coach fills all
 * fields; an already-authenticated caller (accepting a second time, or an
 * existing account with the matching email) sends none of them.
 */
export class AcceptCoachInviteDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional() @IsOptional() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) lastName?: string;
}

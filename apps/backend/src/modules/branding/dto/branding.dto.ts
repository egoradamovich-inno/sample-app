import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

export class UpdateBrandingDto {
  @ApiPropertyOptional({ pattern: '^#[0-9A-Fa-f]{6}$' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColorHex?: string;
}

export class BrandingDto {
  @ApiPropertyOptional({ nullable: true }) @Expose() logoUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() primaryColorHex:
    string | null;
}

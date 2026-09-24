import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Expose } from 'class-transformer';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AvailabilitySlotDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  @Expose()
  dayOfWeek: number;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  @Expose()
  startTime: string;

  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  @Expose()
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Expose()
  isAvailable?: boolean;
}

export class SetAvailabilityDto {
  @ApiPropertyOptional({
    description:
      "Player profile id, for a parent setting a child's availability",
  })
  @IsOptional()
  @IsString()
  ownerProfileId?: string;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}

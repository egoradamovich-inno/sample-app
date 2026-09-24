import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ConflictCheckDto {
  @ApiPropertyOptional({
    description: "Nullable until Epic-02's Event entity exists",
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;
  @ApiProperty() @IsString() @Matches(TIME_PATTERN) startTime: string;
  @ApiProperty() @IsString() @Matches(TIME_PATTERN) endTime: string;
}

export class OverrideConflictDto extends ConflictCheckDto {
  @ApiProperty() @IsNotEmpty() reason: string;
}

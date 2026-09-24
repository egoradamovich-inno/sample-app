import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ImpersonationLogEntryDto {
  @ApiProperty()
  @Expose()
  adminName: string;

  @ApiProperty()
  @Expose()
  targetName: string;

  @ApiProperty()
  @Expose()
  startedAt: string;

  @ApiProperty({ nullable: true })
  @Expose()
  endedAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  durationSeconds: number | null;
}

export class ImpersonationHistoryResponseDto {
  @ApiProperty({ type: [ImpersonationLogEntryDto] })
  @Expose()
  items: ImpersonationLogEntryDto[];

  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  page: number;

  @ApiProperty()
  @Expose()
  pageSize: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RosterMemberDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() name: string;
  @ApiProperty({ enum: ['PLAYER', 'COACH'] }) @Expose() role:
    'PLAYER' | 'COACH';
  @ApiProperty() @Expose() availabilitySummary: string;
}

export class PaginatedRosterDto {
  @ApiProperty({ type: [RosterMemberDto] }) @Expose() items: RosterMemberDto[];
  @ApiProperty() @Expose() total: number;
  @ApiProperty() @Expose() page: number;
  @ApiProperty() @Expose() pageSize: number;
}

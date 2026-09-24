import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CoachInviteListItemDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() targetEmail: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'EXPIRED'] })
  @Expose()
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  @ApiProperty() @Expose() createdAt: string;
  @ApiProperty() @Expose() expiresAt: string;
}

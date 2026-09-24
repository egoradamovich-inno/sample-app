import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CoachInviteResponseDto {
  @ApiProperty() @Expose() code: string;
  @ApiProperty() @Expose() url: string;
  @ApiProperty() @Expose() expiresAt: string;
  @ApiProperty() @Expose() targetEmail: string;
}

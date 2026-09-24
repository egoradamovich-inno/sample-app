import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserSummaryDto } from './user-summary.dto';

export class AuthResponseDto {
  @ApiProperty()
  @Expose()
  accessToken!: string;

  @ApiProperty()
  @Expose()
  refreshToken!: string;

  @ApiProperty({ type: UserSummaryDto })
  @Expose()
  @Type(() => UserSummaryDto)
  user!: UserSummaryDto;
}

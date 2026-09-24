import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserSummaryDto } from '../../auth/dto/user-summary.dto';

export class ImpersonationStartResponseDto {
  @ApiProperty({ type: UserSummaryDto })
  @Expose()
  impersonatedUser: UserSummaryDto;

  @ApiProperty()
  @Expose()
  startedAt: string;

  @ApiProperty()
  @Expose()
  accessToken: string;

  @ApiProperty()
  @Expose()
  refreshToken: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Role, UserStatus } from '../../../../generated/prisma/enums';

/**
 * Never carries passwordHash — enforced by only ever @Expose()-ing this
 * whitelist, not by manually picking fields off the entity.
 */
export class UserSummaryDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty({ enum: Role })
  @Expose()
  role!: Role;

  @ApiProperty({ enum: UserStatus })
  @Expose()
  status!: UserStatus;

  @ApiPropertyOptional()
  @Expose()
  lastLoginAt!: string | null;
}

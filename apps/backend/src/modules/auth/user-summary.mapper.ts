import { Role, UserStatus } from '../../../generated/prisma/enums';
import { UserSummaryDto } from './dto/user-summary.dto';

export interface MappableUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  lastLoginAt?: Date | null;
  profile?: { firstName: string; lastName: string } | null;
}

/**
 * Never includes passwordHash — the source object may carry it, but this
 * mapper only ever reads the whitelisted fields below.
 */
export function toUserSummary(user: MappableUser): UserSummaryDto {
  const dto = new UserSummaryDto();
  dto.id = user.id;
  dto.name = user.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user.email;
  dto.email = user.email;
  dto.role = user.role;
  dto.status = user.status;
  dto.lastLoginAt = user.lastLoginAt ? user.lastLoginAt.toISOString() : null;
  return dto;
}

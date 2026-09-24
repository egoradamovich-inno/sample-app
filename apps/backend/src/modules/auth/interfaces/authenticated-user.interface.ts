import { Role } from '../../../../generated/prisma/enums';

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  parentUserId: string | null;
  impersonatedBy?: string;
}

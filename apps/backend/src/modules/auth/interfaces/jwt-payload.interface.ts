import { Role } from '../../../../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  role: Role;
  parentUserId?: string | null;
  impersonatedBy?: string;
  iat?: number;
  exp?: number;
}

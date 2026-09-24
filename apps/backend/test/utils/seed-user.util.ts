import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Role, UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import { TokenService } from '../../src/modules/auth/token.service';

export interface SeedUserOptions {
  role: Role;
  emailVerified?: boolean;
  status?: UserStatus;
  parentUserId?: string;
  firstName?: string;
  lastName?: string;
}

export interface SeededUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * Creates a real User + Profile row directly via Prisma and mints a token
 * pair via TokenService.issuePair() — the same documented pattern this
 * codebase uses everywhere else to avoid tripping the 5/60s IP-keyed login
 * throttle when a spec needs many distinct logged-in users.
 */
export async function seedUser(
  app: INestApplication,
  options: SeedUserOptions,
): Promise<SeededUser & { accessToken: string; refreshToken: string }> {
  const prisma = app.get(PrismaService);
  const tokenService = app.get(TokenService);

  const email = `${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash('Passw0rd!', 4);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: options.role,
      status: options.status ?? UserStatus.ACTIVE,
      emailVerified: options.emailVerified ?? true,
      parentUserId: options.parentUserId,
      profile: {
        create: {
          firstName: options.firstName ?? 'Test',
          lastName: options.lastName ?? 'User',
        },
      },
    },
  });

  const tokens = await tokenService.issuePair({
    id: user.id,
    role: user.role,
    parentUserId: user.parentUserId,
  });

  return { id: user.id, email: user.email, role: user.role, ...tokens };
}

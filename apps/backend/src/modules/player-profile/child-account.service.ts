import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../../generated/prisma/enums';
import { BCRYPT_COST_FACTOR } from '../../shared/config/bcrypt.constants';
import { AppException } from '../../shared/errors/app-exception';
import { assertNotChildAccount } from '../../shared/errors/assert-not-child-account.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ProvisionChildLoginDto } from './dto/provision-child-login.dto';

export interface ProvisionChildLoginResult {
  userId: string;
}

@Injectable()
export class ChildAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionChildLogin(
    parentUserId: string,
    childProfileId: string,
    dto: ProvisionChildLoginDto,
    isChildAccount: boolean,
  ): Promise<ProvisionChildLoginResult> {
    assertNotChildAccount(isChildAccount);

    const child = (await this.prisma.playerProfile.findFirst({
      where: { id: childProfileId, parentUserId, isChild: true },
    })) as { id: string; userId: string | null; displayName: string } | null;

    if (!child) {
      throw new AppException(
        'PLAYER_PROFILE_NOT_FOUND',
        'This child profile was not found in your family',
        404,
      );
    }
    if (child.userId) {
      throw new AppException(
        'CHILD_LOGIN_ALREADY_EXISTS',
        'This child already has a login',
        409,
      );
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new AppException(
        'DUPLICATE_EMAIL',
        'Email already registered',
        409,
      );
    }

    const [firstName, ...rest] = child.displayName.split(' ');
    const lastName = rest.join(' ') || firstName;
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    const user = await this.prisma.$transaction(async (tx) => {
      // A real second User row with parentUserId set — the actual
      // JWT-level security boundary ChildAccountGuard enforces, not a
      // client-side "acting as" flag. The Profile row is created in the
      // same transaction — a documented past bug class in this exact
      // problem space is forgetting it.
      const createdUser = (await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: Role.PLAYER,
          parentUserId,
          emailVerified: true,
          profile: { create: { firstName, lastName } },
        },
      })) as { id: string };

      await tx.playerProfile.update({
        where: { id: childProfileId },
        data: { userId: createdUser.id },
      });

      return createdUser;
    });

    return { userId: user.id };
  }
}

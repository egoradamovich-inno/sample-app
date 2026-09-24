import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app-exception';
import { BLOCK_CHILD_ACCOUNTS_KEY } from '../decorators/block-child-accounts.decorator';

interface RequestWithUser {
  user?: { parentUserId?: string | null };
}

@Injectable()
export class ChildAccountGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isBlocked = this.reflector.getAllAndOverride<boolean>(
      BLOCK_CHILD_ACCOUNTS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isBlocked) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.parentUserId) {
      throw new AppException(
        'CHILD_ACCOUNT_RESTRICTED',
        'This action is not available to a child account',
        403,
      );
    }

    return true;
  }
}

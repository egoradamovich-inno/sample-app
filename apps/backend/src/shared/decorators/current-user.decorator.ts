import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../modules/auth/interfaces/authenticated-user.interface';

interface RequestWithUser {
  user: AuthenticatedUser;
}

/**
 * Pulls the caller's identity straight off the JWT-populated req.user —
 * this codebase's established convention of never trusting a path/body id
 * when the caller's own identity is available from the token.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

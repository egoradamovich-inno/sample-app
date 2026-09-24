import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Like JwtAuthGuard, but never rejects: a missing/invalid token simply
 * leaves req.user undefined instead of throwing. Used on routes that must
 * behave differently for an anonymous caller vs. an already-logged-in one
 * (e.g. ShareLink registration: a brand-new user vs. an existing parent
 * associating a second trainer) without splitting into two endpoints.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | undefined {
    return user ? user : undefined;
  }
}

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function createContext(): ExecutionContext {
  return {
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('should allow the route through without invoking Passport when @Public() metadata is present', () => {
    const reflector = new Reflector();
    const getAllAndOverrideSpy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(true);
    const guard = new JwtAuthGuard(reflector);

    const result = guard.canActivate(createContext());

    expect(result).toBe(true);
    expect(getAllAndOverrideSpy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('should return the authenticated user when Passport resolves it with no error', () => {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(reflector);
    const user = { userId: 'u1', role: 'PLAYER', parentUserId: null };

    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  it('should throw UnauthorizedException for an expired/malformed token', () => {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(reflector);

    expect(() => guard.handleRequest(null, false, null)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.handleRequest(new Error('jwt expired'), false, null),
    ).toThrow(UnauthorizedException);
  });
});

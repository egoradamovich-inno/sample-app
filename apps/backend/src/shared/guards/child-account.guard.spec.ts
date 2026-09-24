import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app-exception';
import { ChildAccountGuard } from './child-account.guard';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('ChildAccountGuard', () => {
  it('should reject with CHILD_ACCOUNT_RESTRICTED when the caller is a child session on a blocked route', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const guard = new ChildAccountGuard(reflector);

    try {
      guard.canActivate(createContext({ parentUserId: 'parent-1' }));
      fail('expected AppException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).errorCode).toBe(
        'CHILD_ACCOUNT_RESTRICTED',
      );
      expect((error as AppException).getStatus()).toBe(403);
    }
  });

  it('should allow a non-child caller through on a blocked route', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const guard = new ChildAccountGuard(reflector);

    expect(guard.canActivate(createContext({ parentUserId: null }))).toBe(true);
  });

  it('should allow a child caller through when the route has no @BlockChildAccounts() metadata', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const guard = new ChildAccountGuard(reflector);

    expect(guard.canActivate(createContext({ parentUserId: 'parent-1' }))).toBe(
      true,
    );
  });
});

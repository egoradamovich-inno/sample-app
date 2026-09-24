import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/enums';
import { RolesGuard } from './roles.guard';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('should allow the request when the user role is in the required list', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TRAINER]);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.TRAINER }))).toBe(true);
  });

  it('should reject with 403 when the user role is not in the required list', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TRAINER]);
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ role: Role.PLAYER })),
    ).toThrow(ForbiddenException);
  });

  it('should allow the request when no @Roles() metadata is set', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.PLAYER }))).toBe(true);
  });
});

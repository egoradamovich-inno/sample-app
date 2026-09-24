import { Request } from 'express';
import { Role } from '../../../../generated/prisma/enums';
import { extractJwtFromRequest, JwtStrategy } from './jwt.strategy';

function mockRequest(opts: {
  cookies?: Record<string, string>;
  authHeader?: string;
}): Request {
  return {
    cookies: opts.cookies,
    headers: opts.authHeader ? { authorization: opts.authHeader } : {},
  } as unknown as Request;
}

describe('JwtStrategy', () => {
  it('should map the JWT payload onto an AuthenticatedUser', () => {
    const strategy = new JwtStrategy();

    const result = strategy.validate({
      sub: 'user-1',
      role: Role.TRAINER,
      parentUserId: null,
    });

    expect(result).toEqual({
      userId: 'user-1',
      role: Role.TRAINER,
      parentUserId: null,
      impersonatedBy: undefined,
    });
  });

  it('should carry impersonatedBy through when present', () => {
    const strategy = new JwtStrategy();

    const result = strategy.validate({
      sub: 'target-user',
      role: Role.PLAYER,
      parentUserId: undefined,
      impersonatedBy: 'admin-1',
    });

    expect(result.impersonatedBy).toBe('admin-1');
    expect(result.parentUserId).toBeNull();
  });
});

describe('extractJwtFromRequest', () => {
  it('should prefer the impersonation_access_token cookie over everything else', () => {
    const req = mockRequest({
      cookies: {
        impersonation_access_token: 'impersonation-token',
        access_token: 'regular-cookie-token',
      },
      authHeader: 'Bearer header-token',
    });

    expect(extractJwtFromRequest(req)).toBe('impersonation-token');
  });

  it('should fall back to the access_token cookie when no impersonation cookie is present', () => {
    const req = mockRequest({
      cookies: { access_token: 'regular-cookie-token' },
      authHeader: 'Bearer header-token',
    });

    expect(extractJwtFromRequest(req)).toBe('regular-cookie-token');
  });

  it('should fall back to the Authorization header when no auth cookies are present (non-browser/API clients)', () => {
    const req = mockRequest({ authHeader: 'Bearer header-token' });

    expect(extractJwtFromRequest(req)).toBe('header-token');
  });

  it('should return null when neither cookies nor an Authorization header are present', () => {
    const req = mockRequest({});

    expect(extractJwtFromRequest(req)).toBeNull();
  });
});

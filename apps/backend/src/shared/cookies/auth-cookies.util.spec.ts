import { Response } from 'express';
import {
  JWT_ACCESS_EXPIRES_IN_SECONDS,
  JWT_IMPERSONATION_REFRESH_EXPIRES_IN_MS,
  JWT_REFRESH_EXPIRES_IN_MS,
} from '../config/jwt.constants';
import {
  clearAuthCookies,
  clearImpersonationCookies,
  setAuthCookies,
  setImpersonationCookies,
} from './auth-cookies.util';
import {
  ACCESS_TOKEN_COOKIE,
  IMPERSONATION_ACCESS_TOKEN_COOKIE,
  IMPERSONATION_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './cookie.constants';

function createMockResponse(): {
  res: Response;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
} {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  return {
    res: { cookie, clearCookie } as unknown as Response,
    cookie,
    clearCookie,
  };
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('setAuthCookies', () => {
  it('should set httpOnly access_token and refresh_token cookies with the expected maxAge', () => {
    const { res, cookie } = createMockResponse();

    setAuthCookies(res, { accessToken: 'a-token', refreshToken: 'r-token' });

    expect(cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'a-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: JWT_ACCESS_EXPIRES_IN_SECONDS * 1000,
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'r-token',
      expect.objectContaining({ maxAge: JWT_REFRESH_EXPIRES_IN_MS }),
    );
  });

  it('should accept a refreshMaxAgeMs override (impersonation-capped refresh)', () => {
    const { res, cookie } = createMockResponse();

    setAuthCookies(
      res,
      { accessToken: 'a-token', refreshToken: 'r-token' },
      60 * 60 * 1000,
    );

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'r-token',
      expect.objectContaining({ maxAge: 60 * 60 * 1000 }),
    );
  });

  it('should only mark cookies secure when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'development';
    const dev = createMockResponse();
    setAuthCookies(dev.res, { accessToken: 'a', refreshToken: 'r' });
    expect(dev.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'a',
      expect.objectContaining({ secure: false }),
    );

    process.env.NODE_ENV = 'production';
    const prod = createMockResponse();
    setAuthCookies(prod.res, { accessToken: 'a', refreshToken: 'r' });
    expect(prod.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'a',
      expect.objectContaining({ secure: true }),
    );
  });
});

describe('clearAuthCookies', () => {
  it('should clear exactly access_token and refresh_token', () => {
    const { res, clearCookie } = createMockResponse();

    clearAuthCookies(res);

    expect(clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(clearCookie).toHaveBeenCalledTimes(2);
  });
});

describe('setImpersonationCookies / clearImpersonationCookies', () => {
  it('should use a distinct cookie pair from the regular session cookies', () => {
    const { res, cookie } = createMockResponse();

    setImpersonationCookies(res, {
      accessToken: 'imp-access',
      refreshToken: 'imp-refresh',
    });

    expect(cookie).toHaveBeenCalledWith(
      IMPERSONATION_ACCESS_TOKEN_COOKIE,
      'imp-access',
      expect.objectContaining({
        maxAge: JWT_ACCESS_EXPIRES_IN_SECONDS * 1000,
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      IMPERSONATION_REFRESH_TOKEN_COOKIE,
      'imp-refresh',
      expect.objectContaining({
        maxAge: JWT_IMPERSONATION_REFRESH_EXPIRES_IN_MS,
      }),
    );
    expect(cookie).not.toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.anything(),
      expect.anything(),
    );
    expect(cookie).not.toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.anything(),
      expect.anything(),
    );
  });

  it('should clear only the impersonation cookie pair, never the regular session cookies', () => {
    const { res, clearCookie } = createMockResponse();

    clearImpersonationCookies(res);

    expect(clearCookie).toHaveBeenCalledWith(
      IMPERSONATION_ACCESS_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      IMPERSONATION_REFRESH_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(clearCookie).toHaveBeenCalledTimes(2);
    expect(clearCookie).not.toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.anything(),
    );
    expect(clearCookie).not.toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.anything(),
    );
  });
});

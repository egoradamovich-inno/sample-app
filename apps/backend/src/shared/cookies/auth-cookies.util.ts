import { CookieOptions, Response } from 'express';
import {
  JWT_ACCESS_EXPIRES_IN_SECONDS,
  JWT_IMPERSONATION_REFRESH_EXPIRES_IN_MS,
  JWT_REFRESH_EXPIRES_IN_MS,
} from '../config/jwt.constants';
import {
  ACCESS_TOKEN_COOKIE,
  IMPERSONATION_ACCESS_TOKEN_COOKIE,
  IMPERSONATION_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './cookie.constants';

export interface CookieTokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Flags shared by every auth cookie this app sets. `secure` is gated on
 * NODE_ENV==='production' (not always-on) so local HTTP dev keeps working —
 * every real deploy is expected to run behind HTTPS with NODE_ENV=production.
 * `clearCookie` must be called with the *same* options used to set the
 * cookie (browsers key deletion on name+path+domain), so both set/clear
 * helpers below share this one builder.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** The caller's own session cookies — set on login/refresh. */
export function setAuthCookies(
  res: Response,
  tokens: CookieTokenPair,
  refreshMaxAgeMs: number = JWT_REFRESH_EXPIRES_IN_MS,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions(),
    maxAge: JWT_ACCESS_EXPIRES_IN_SECONDS * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions(),
    maxAge: refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions());
}

/**
 * A *second*, independent cookie pair for an impersonation session — never
 * touches ACCESS_TOKEN_COOKIE/REFRESH_TOKEN_COOKIE, so the admin's own
 * session survives underneath, untouched, for the whole impersonation
 * lifetime and after exit.
 */
export function setImpersonationCookies(
  res: Response,
  tokens: CookieTokenPair,
): void {
  res.cookie(IMPERSONATION_ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions(),
    maxAge: JWT_ACCESS_EXPIRES_IN_SECONDS * 1000,
  });
  res.cookie(IMPERSONATION_REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions(),
    maxAge: JWT_IMPERSONATION_REFRESH_EXPIRES_IN_MS,
  });
}

export function clearImpersonationCookies(res: Response): void {
  res.clearCookie(IMPERSONATION_ACCESS_TOKEN_COOKIE, baseCookieOptions());
  res.clearCookie(IMPERSONATION_REFRESH_TOKEN_COOKIE, baseCookieOptions());
}

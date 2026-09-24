/**
 * The caller's own session — mirrors the accessToken/refreshToken pair
 * already returned in AuthResponseDto's body, set as httpOnly cookies too
 * (additive, not a replacement of the JSON contract).
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * A second, independent cookie pair for an active impersonation session.
 * Deliberately never shares a name with the pair above so starting/exiting
 * impersonation never reads, overwrites, or clears the admin's own session
 * cookies — see shared/cookies/auth-cookies.util.ts and
 * modules/auth/strategies/jwt.strategy.ts's extraction precedence.
 */
export const IMPERSONATION_ACCESS_TOKEN_COOKIE = 'impersonation_access_token';
export const IMPERSONATION_REFRESH_TOKEN_COOKIE = 'impersonation_refresh_token';

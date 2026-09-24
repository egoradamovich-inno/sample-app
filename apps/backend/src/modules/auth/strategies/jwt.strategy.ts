import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_SECRET } from '../../../shared/config/jwt.constants';
import {
  ACCESS_TOKEN_COOKIE,
  IMPERSONATION_ACCESS_TOKEN_COOKIE,
} from '../../../shared/cookies/cookie.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/** Reads a single named cookie, or null if absent/no cookie-parser ran. */
export function cookieExtractor(
  cookieName: string,
): (req: Request) => string | null {
  return (req: Request): string | null => {
    // @types/cookie-parser globally augments express.Request.cookies as
    // Record<string, any> — narrow the read explicitly rather than letting
    // `any` propagate out of this extractor.
    const value: unknown = req.cookies?.[cookieName];
    return typeof value === 'string' ? value : null;
  };
}

/**
 * Extraction precedence — exported standalone so it's unit-testable without
 * standing up the full Passport strategy:
 *
 * 1. `impersonation_access_token` cookie — while an admin is impersonating,
 *    every request must authenticate as the impersonated user even though
 *    the admin's own `access_token` cookie is still present underneath.
 * 2. `access_token` cookie — the caller's own browser session.
 * 3. `Authorization: Bearer` header — non-browser/API clients, and kept so
 *    existing header-based tests/integrations keep working unchanged.
 */
export const extractJwtFromRequest = ExtractJwt.fromExtractors([
  cookieExtractor(IMPERSONATION_ACCESS_TOKEN_COOKIE),
  cookieExtractor(ACCESS_TOKEN_COOKIE),
  ExtractJwt.fromAuthHeaderAsBearerToken(),
]);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: JWT_ACCESS_SECRET,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      role: payload.role,
      parentUserId: payload.parentUserId ?? null,
      impersonatedBy: payload.impersonatedBy,
    };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  clearAuthCookies,
  clearImpersonationCookies,
  setAuthCookies,
  setImpersonationCookies,
} from '../../shared/cookies/auth-cookies.util';
import {
  IMPERSONATION_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../shared/cookies/cookie.constants';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { CampConversionService } from '../camp-conversion/camp-conversion.service';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';
import { toUserSummary } from './user-summary.mapper';
import { VerificationService } from './verification.service';

function readCookie(req: Request, name: string): string | undefined {
  // @types/cookie-parser globally augments express.Request.cookies as
  // Record<string, any> — narrow the read explicitly rather than letting
  // `any` propagate out of this helper.
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * A pure-cookie browser client has no JS-readable refresh token to put in
 * the body, so /auth/refresh and /auth/logout fall back to reading it off
 * the request cookies (regular session first, then an active impersonation
 * session) whenever the body omits it. Non-browser/API clients are
 * unaffected — they keep sending it in the body exactly as before.
 */
function resolveRawRefreshToken(
  dto: RefreshTokenDto,
  req: Request,
): string | undefined {
  return (
    dto.refreshToken ??
    readCookie(req, REFRESH_TOKEN_COOKIE) ??
    readCookie(req, IMPERSONATION_REFRESH_TOKEN_COOKIE)
  );
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationService: VerificationService,
    private readonly tokenService: TokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly campConversionService: CampConversionService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ id: string; email: string; emailVerified: boolean }> {
    const user = await this.authService.register(dto);
    // Consuming a camp-conversion draft (I1) invalidates it and associates
    // the new account with the trainer named in its payload — reusing
    // TrainerAssociationService (F2) rather than a duplicated path.
    if (dto.draftToken) {
      await this.campConversionService.consumeDraft(dto.draftToken, user.id);
    }
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.verificationService.verifyEmail(dto.token);
    return { verified: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.verificationService.resendVerification(dto.email);
    // Generic response regardless of whether the email exists or is
    // already verified — same no-enumeration convention as
    // /auth/password-reset/request.
    return {
      message:
        'If an account exists for that email and needs verification, a new link has been sent.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    // Cookies are additive — the JSON body below is unchanged so existing
    // non-browser/API clients and e2e tests reading tokens from the body
    // keep working exactly as before.
    setAuthCookies(res, { accessToken, refreshToken });
    const response = new AuthResponseDto();
    response.accessToken = accessToken;
    response.refreshToken = refreshToken;
    response.user = toUserSummary(user);
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const rawToken = resolveRawRefreshToken(dto, req);
    if (!rawToken) {
      throw new InvalidRefreshTokenException();
    }

    const tokens = await this.tokenService.refresh(rawToken);
    // Which cookie pair to set is decided from server-side truth
    // (tokens.impersonatedBy, resolved from the stored refresh token record)
    // rather than which cookie the raw token happened to come from — a
    // non-browser client refreshing an impersonation session via the body
    // still gets the correct pair set.
    if (tokens.impersonatedBy) {
      setImpersonationCookies(res, tokens);
    } else {
      setAuthCookies(res, tokens);
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = resolveRawRefreshToken(dto, req);
    if (!rawToken) {
      // Nothing to revoke server-side, but still clear any stale cookies so
      // the browser session ends cleanly either way.
      clearAuthCookies(res);
      clearImpersonationCookies(res);
      return;
    }

    const { impersonatedBy } = await this.authService.logout(rawToken);
    // Clear only the pair that matched this token — logging out of an
    // impersonated session must never clear the admin's own session cookies.
    if (impersonatedBy) {
      clearImpersonationCookies(res);
    } else {
      clearAuthCookies(res);
    }
  }

  @ApiOperation({
    summary:
      "Return the authenticated caller's identity derived from the JWT " +
      '(cookie- or header-authenticated). Frontend should use this instead ' +
      'of decoding the JWT client-side.',
  })
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.authService.getMe(user);
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.request(dto.email);
    // Generic response regardless of whether the email exists — FR-004.
    return {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.confirm(dto.token, dto.newPassword);
    return { message: 'Password has been reset.' };
  }
}

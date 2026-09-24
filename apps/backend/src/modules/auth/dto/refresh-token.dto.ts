import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  // Optional so a pure-cookie browser client (no JS-readable token to send)
  // can omit it — the controller falls back to reading refresh_token /
  // impersonation_refresh_token off the request cookies when this is absent.
  // Non-browser/API clients keep sending it in the body exactly as before.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

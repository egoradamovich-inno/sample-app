import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Role } from '../../../../generated/prisma/enums';

/**
 * Response shape for GET /auth/me — the caller's identity derived from the
 * validated JWT payload (cookie- or header-authenticated, whichever the
 * JwtStrategy extracted). Frontend should call this instead of decoding the
 * JWT client-side: with httpOnly cookies the token itself is never
 * JS-readable, and this is the one place the decoded payload is exposed
 * back to the browser as plain JSON.
 *
 * `impersonatedBy` is only present while an admin is actively impersonating
 * this session (set from the `impersonation_access_token` cookie taking
 * precedence — see JwtStrategy); it is the admin's own userId, not a name.
 */
export class MeResponseDto {
  @ApiProperty({ description: "The authenticated caller's own user id" })
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty({ enum: Role })
  @Expose()
  role!: Role;

  @ApiPropertyOptional({
    nullable: true,
    description: "Set when this is a child account — the parent's user id",
  })
  @Expose()
  parentUserId!: string | null;

  @ApiPropertyOptional({
    description:
      "Set only while an admin is impersonating this session — the admin's userId",
  })
  @Expose()
  impersonatedBy?: string;
}

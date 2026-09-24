import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Role, UserStatus } from '../../../../generated/prisma/enums';

/**
 * Read-only from this endpoint's contract: email, role, skillLevel,
 * createdAt are never accepted by UpdateProfileDto — this response shape
 * is the only place they're returned.
 */
export class ProfileResponseDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() email: string;
  @ApiProperty({ enum: Role }) @Expose() role: Role;
  @ApiProperty({ enum: UserStatus }) @Expose() status: UserStatus;
  @ApiProperty() @Expose() createdAt: string;
  @ApiProperty() @Expose() firstName: string;
  @ApiProperty() @Expose() lastName: string;
  @ApiPropertyOptional({ nullable: true }) @Expose() phone: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() photoUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() school: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() skillLevel: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() bio: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() credentials: string | null;
  @ApiPropertyOptional({ type: [String] }) @Expose() certifications: string[];
  @ApiPropertyOptional() @Expose() publicVisible: boolean;
  @ApiPropertyOptional({ nullable: true }) @Expose() jerseyNumber:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() emergencyContact:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() businessName:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() address: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() website: string | null;
  @ApiPropertyOptional({ nullable: true }) @Expose() description: string | null;
}

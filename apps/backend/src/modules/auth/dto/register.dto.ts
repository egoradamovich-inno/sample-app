import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt's own input cap
  password!: string;

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9\s-()]{7,20}$/)
  phone?: string;

  @ApiPropertyOptional({
    description: 'ShareLink code, if registering via invite',
  })
  @IsOptional()
  @IsString()
  shareLinkCode?: string;

  @ApiPropertyOptional({
    description:
      'Camp-conversion prefill draft token, if registering from a ' +
      'prefilled camp-conversion form (GET /auth/register?draftToken=...). ' +
      'Consuming it invalidates the draft and associates the new account ' +
      "with the trainer named in the draft's payload.",
  })
  @IsOptional()
  @IsString()
  draftToken?: string;
}

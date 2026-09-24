import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EmailModule } from '../../shared/email/email.module';
import { CampConversionModule } from '../camp-conversion/camp-conversion.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    EmailModule,
    CampConversionModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    VerificationService,
    TokenService,
    PasswordResetService,
  ],
  exports: [PassportModule, AuthService, TokenService, PasswordResetService],
})
export class AuthModule {}

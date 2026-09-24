import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BrandingModule } from './modules/branding/branding.module';
import { CampConversionModule } from './modules/camp-conversion/camp-conversion.module';
import { CoachProfileModule } from './modules/coach-profile/coach-profile.module';
import { ImpersonationModule } from './modules/impersonation/impersonation.module';
import { PlayerProfileModule } from './modules/player-profile/player-profile.module';
import { ProfileModule } from './modules/profile/profile.module';
import { PurchaseApprovalModule } from './modules/purchase-approval/purchase-approval.module';
import { ShareLinkModule } from './modules/sharelink/sharelink.module';
import { TrainerRosterModule } from './modules/trainer-roster/trainer-roster.module';
import { UsersModule } from './modules/users/users.module';
import { ChildAccountGuard } from './shared/guards/child-account.guard';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    // No envFilePath override: resolves .env relative to process.cwd(),
    // which is apps/backend once npm workspaces' --workspace flag kicks in.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    UsersModule,
    ImpersonationModule,
    ProfileModule,
    ShareLinkModule,
    PlayerProfileModule,
    PurchaseApprovalModule,
    AvailabilityModule,
    CoachProfileModule,
    TrainerRosterModule,
    BrandingModule,
    CampConversionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard chain order matters: JwtAuthGuard populates req.user first,
    // RolesGuard needs it for role checks, ChildAccountGuard runs last so a
    // role rejection never falls through to a child-account check.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ChildAccountGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

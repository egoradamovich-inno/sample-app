import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../shared/email/email.module';
import { CoachInviteAcceptController } from './coach-invite-accept.controller';
import { CoachInviteAcceptService } from './coach-invite-accept.service';
import { PlayerRegistrationController } from './player-registration.controller';
import { PlayerRegistrationService } from './player-registration.service';
import { ShareLinkController } from './sharelink.controller';
import { ShareLinkService } from './sharelink.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [
    ShareLinkController,
    PlayerRegistrationController,
    CoachInviteAcceptController,
  ],
  providers: [
    ShareLinkService,
    PlayerRegistrationService,
    CoachInviteAcceptService,
  ],
  exports: [ShareLinkService],
})
export class ShareLinkModule {}

import { Module } from '@nestjs/common';
import { CoachAvailabilityOverrideService } from './coach-availability-override.service';
import { CoachProfileController } from './coach-profile.controller';
import { CoachProfileService } from './coach-profile.service';

@Module({
  controllers: [CoachProfileController],
  providers: [CoachProfileService, CoachAvailabilityOverrideService],
})
export class CoachProfileModule {}

import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { TrainerRosterController } from './trainer-roster.controller';
import { TrainerRosterService } from './trainer-roster.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [TrainerRosterController],
  providers: [TrainerRosterService],
})
export class TrainerRosterModule {}

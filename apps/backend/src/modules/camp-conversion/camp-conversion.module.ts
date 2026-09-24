import { Module } from '@nestjs/common';
import { PlayerProfileModule } from '../player-profile/player-profile.module';
import { CampConversionController } from './camp-conversion.controller';
import { CampConversionService } from './camp-conversion.service';

@Module({
  imports: [PlayerProfileModule],
  controllers: [CampConversionController],
  providers: [CampConversionService],
  // Exported so AuthController can call consumeDraft() when a registration
  // supplies a draftToken.
  exports: [CampConversionService],
})
export class CampConversionModule {}

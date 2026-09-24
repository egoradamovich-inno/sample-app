import { Module } from '@nestjs/common';
import { ChildAccountService } from './child-account.service';
import { PlayerProfileController } from './player-profile.controller';
import { PlayerProfileService } from './player-profile.service';
import { TrainerAssociationService } from './trainer-association.service';

@Module({
  controllers: [PlayerProfileController],
  providers: [
    PlayerProfileService,
    TrainerAssociationService,
    ChildAccountService,
  ],
  // TrainerAssociationService is also exported for CampConversionService to
  // reuse its association logic when consuming a camp-conversion draft.
  exports: [PlayerProfileService, TrainerAssociationService],
})
export class PlayerProfileModule {}

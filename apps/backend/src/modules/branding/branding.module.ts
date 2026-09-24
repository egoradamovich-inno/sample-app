import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [StorageModule],
  controllers: [BrandingController],
  providers: [BrandingService],
})
export class BrandingModule {}

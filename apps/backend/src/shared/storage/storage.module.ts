import { Module } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';
import { STORAGE_SERVICE } from './storage.service';

@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalDiskStorage }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}

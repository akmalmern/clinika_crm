import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Storage (MinIO/S3) — global modul. Har qanday modul StorageService'ni inject
 * qila oladi (File moduli, kelajakda boshqa modullar). Spec 13: core/storage.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { FilesModule } from './files.module';
import { FILES_CLEANUP_QUEUE } from './cleanup/files-cleanup.constant';
import { FilesCleanupProcessor } from './cleanup/files-cleanup.processor';
import { FilesCleanupService } from './cleanup/files-cleanup.service';

/**
 * Fayl cleanup (BullMQ) — alohida modul, FAQAT test bo'lmagan muhitda yuklanadi.
 * @Global — Staff/Patient modullari FilesCleanupService'ni @Optional inject qiladi
 * (egani o'chirganda fayl tozalashni navbatga qo'yish). Test'da modul yuklanmaydi ->
 * @Optional undefined -> inline cleanupOwner fallback ishlatiladi.
 */
@Global()
@Module({
  imports: [
    FilesModule,
    BullModule.registerQueue({ name: FILES_CLEANUP_QUEUE }),
  ],
  providers: [FilesCleanupProcessor, FilesCleanupService],
  exports: [FilesCleanupService],
})
export class FilesCleanupModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FilesModule } from './files.module';
import { FILES_CLEANUP_QUEUE } from './cleanup/files-cleanup.constant';
import { FilesCleanupProcessor } from './cleanup/files-cleanup.processor';
import { FilesCleanupService } from './cleanup/files-cleanup.service';

/**
 * Fayl cleanup (BullMQ) — alohida modul, FAQAT test bo'lmagan muhitda yuklanadi.
 * BullMQ ulanishi global QueueModule orqali. FilesCleanupService eksport qilinadi —
 * kelajakdagi modullar (staff/patient) egani o'chirganda chaqiradi.
 */
@Module({
  imports: [
    FilesModule,
    BullModule.registerQueue({ name: FILES_CLEANUP_QUEUE }),
  ],
  providers: [FilesCleanupProcessor, FilesCleanupService],
  exports: [FilesCleanupService],
})
export class FilesCleanupModule {}

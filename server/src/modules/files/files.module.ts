import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

/**
 * Universal fayl moduli (Phase 4). BullMQ'ga BOG'LIQ EMAS — cleanup navbati alohida
 * `FilesCleanupModule`'da (test muhitida Redis'siz ham yuklanadi). Storage/Prisma/
 * Audit global modullardan keladi.
 */
@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

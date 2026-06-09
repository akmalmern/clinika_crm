import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { EmrController } from './emr.controller';
import { EmrService } from './emr.service';
import { PrescriptionPdfService } from './prescription-pdf.service';

/**
 * EMR moduli (Phase 6). FilesModule — skan fayllar uchun. FilesCleanupService
 * (@Optional) ko'rik o'chganda fayllarni tozalash uchun (global, prod'da).
 */
@Module({
  imports: [FilesModule],
  controllers: [EmrController],
  providers: [EmrService, PrescriptionPdfService],
  exports: [EmrService],
})
export class EmrModule {}

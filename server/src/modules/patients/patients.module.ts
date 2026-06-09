import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

/** Bemorlar moduli. FilesModule — rasm/hujjatlar uchun. */
@Module({
  imports: [FilesModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}

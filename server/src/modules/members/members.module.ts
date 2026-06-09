import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

/**
 * Xodimlar (staff) moduli. FilesModule'ni import qiladi — avatar/hujjatlar uchun.
 * FilesCleanupService (BullMQ) @Optional inject qilinadi (global, prod'da).
 */
@Module({
  imports: [FilesModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}

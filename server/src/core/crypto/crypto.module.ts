import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * Maydon shifrlash (encryption at rest, spec 9B) — global modul. PrismaModule
 * factory'si va boshqa servislar CryptoService'ni inject qiladi (shaffof
 * shifrlash/deshifrlash Prisma extension'da).
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}

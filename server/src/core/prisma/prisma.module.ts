import { Global, Inject, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { extendPrismaClient, ExtendedPrismaClient } from './prisma-extensions';
import { CryptoService } from '../crypto/crypto.service';

/**
 * Kengaytirilgan Prisma client uchun injection token'i.
 * Servislar shu token orqali oladi va `prisma.superAdmin.findFirst(...)` kabi
 * ishlatadi — tenant/soft-delete/uuid avtomatik qo'llanadi.
 */
export const EXTENDED_PRISMA = Symbol('EXTENDED_PRISMA');

/** Qulay inject dekoratori: `@InjectPrisma() private prisma: ExtendedPrismaClient`. */
export const InjectPrisma = () => Inject(EXTENDED_PRISMA);

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: EXTENDED_PRISMA,
      inject: [PrismaService, CryptoService],
      useFactory: (
        base: PrismaService,
        crypto: CryptoService,
      ): ExtendedPrismaClient => extendPrismaClient(base, crypto),
    },
  ],
  exports: [PrismaService, EXTENDED_PRISMA],
})
export class PrismaModule {}

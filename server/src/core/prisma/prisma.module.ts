import { Global, Inject, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { extendPrismaClient, ExtendedPrismaClient } from './prisma-extensions';

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
      inject: [PrismaService],
      useFactory: (base: PrismaService): ExtendedPrismaClient =>
        extendPrismaClient(base),
    },
  ],
  exports: [PrismaService, EXTENDED_PRISMA],
})
export class PrismaModule {}

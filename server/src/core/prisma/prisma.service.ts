import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Asosiy (kengaytirilmagan) Prisma client. Ulanish hayot siklini boshqaradi.
 * Kengaytirilgan (tenant/soft-delete/uuid) versiya `EXTENDED_PRISMA` provayderi
 * orqali shu instansiya asosida quriladi va u BIR XIL engine/ulanishni ishlatadi —
 * shuning uchun bu yerdagi $connect/$disconnect ikkalasiga ham amal qiladi.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('Prisma');

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL ulanishi tayyor');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

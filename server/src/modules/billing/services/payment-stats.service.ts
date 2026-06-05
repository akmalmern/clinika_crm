import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { TransactionStatus } from '../constants/billing.constant';
import { PaymentStatsQueryDto } from '../dto/stats-query.dto';

export interface MethodStatRow {
  provider: string;
  method: string | null;
  count: number;
  totalAmount: string;
}

export interface PaymentStatsResult {
  rows: MethodStatRow[];
  totals: { count: number; totalAmount: string };
}

/**
 * To'lov usuli statistikasi (spec 5.4) — faqat SUPER_ADMIN. PAID tranzaksiyalarni
 * provider+method bo'yicha guruhlaydi. Pul Decimal -> string (Float EMAS).
 */
@Injectable()
export class PaymentStatsService {
  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  async byMethod(query: PaymentStatsQueryDto): Promise<PaymentStatsResult> {
    const where: Prisma.TransactionWhereInput = {
      status: TransactionStatus.PAID,
    };
    if (query.provider) where.provider = query.provider;
    if (query.from || query.to) {
      const performedAt: Prisma.DateTimeNullableFilter = {};
      if (query.from) performedAt.gte = new Date(query.from);
      if (query.to) performedAt.lte = new Date(query.to);
      where.performedAt = performedAt;
    }

    const grouped = await this.prisma.transaction.groupBy({
      by: ['provider', 'method'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    });

    const rows: MethodStatRow[] = grouped.map((g) => ({
      provider: g.provider,
      method: g.method,
      count: g._count._all,
      totalAmount: (g._sum.amount ?? new Prisma.Decimal(0)).toString(),
    }));

    const totalCount = rows.reduce((acc, r) => acc + r.count, 0);
    const totalAmount = rows
      .reduce(
        (acc, r) => acc.plus(new Prisma.Decimal(r.totalAmount)),
        new Prisma.Decimal(0),
      )
      .toString();

    return { rows, totals: { count: totalCount, totalAmount } };
  }
}

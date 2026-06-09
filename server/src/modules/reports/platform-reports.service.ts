import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { ReportsConfig } from '../../config/configuration';
import {
  InvoiceStatus,
  TransactionStatus,
} from '../billing/constants/billing.constant';
import { SubscriptionStatus } from '../../common/constants/subscription.constant';
import { ReportsCacheService } from './reports-cache.service';
import type {
  PeriodPoint,
  RangeMeta,
  StatusCount,
} from './clinic-reports.service';
import {
  ReportRangeQueryDto,
  ReportTopQueryDto,
} from './dto/report-query.dto';
import {
  decStr,
  formatPeriod,
  num,
  periodExpr,
  resolveRange,
} from './report-sql.util';

// ---- Javob shakllari ----
export interface PlatformOverview {
  clinics: { total: number; byStatus: StatusCount[] };
  subscriptions: { active: number; byStatus: StatusCount[] };
}
export interface ProviderPoint {
  provider: string;
  count: number;
  total: string;
}
export interface PlatformRevenueReport {
  range: RangeMeta;
  byPeriod: PeriodPoint[];
  byProvider: ProviderPoint[];
  totals: { count: number; total: string };
}
export interface ExpiringSub {
  clinicId: string;
  clinicName: string | null;
  nextBillingDate: string | null;
}
export interface DebtorClinic {
  clinicId: string;
  clinicName: string | null;
  totalDebt: string;
}
export interface PlatformSubscriptions {
  active: number;
  byStatus: StatusCount[];
  expiringSoon: { days: number; count: number; items: ExpiringSub[] };
  debtors: { count: number; totalDebt: string; items: DebtorClinic[] };
}
export interface TopClinicRow {
  clinicId: string;
  clinicName: string | null;
  patients: number;
  appointments: number;
}
export interface TopClinicsReport {
  range: RangeMeta;
  rows: TopClinicRow[];
}

// ---- Raw qatorlar ----
interface RawStatus {
  status: string;
  count: number;
}
interface RawPeriod {
  period: Date;
  count: number;
  total: Prisma.Decimal | string | null;
}
interface RawProvider {
  provider: string;
  count: number;
  total: Prisma.Decimal | string | null;
}
interface RawExpiring {
  clinic_id: string;
  clinic_name: string | null;
  next_billing_date: Date | null;
}
interface RawDebtor {
  clinic_id: string;
  clinic_name: string | null;
  total_debt: Prisma.Decimal | string | null;
}
interface RawTopClinic {
  clinic_id: string;
  clinic_name: string | null;
  patients: number;
  appointments: number;
}

/**
 * Platforma (Super Admin) global statistikasi (spec 4/13) — tenant filtridan
 * MUSTASNO (super admin'da clinic_id yo'q -> raw so'rovlar global). FAQAT
 * SUPER_ADMIN (controller @Roles). Agregatsiya DB darajasida (GROUP BY).
 */
@Injectable()
export class PlatformReportsService {
  private readonly tz: number;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly cache: ReportsCacheService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<ReportsConfig>('reports').tzOffsetMinutes;
  }

  // ---- Umumiy ko'rinish (klinikalar + obunalar holati) ----
  async overview(): Promise<PlatformOverview> {
    const key = this.cache.buildKey('platform', 'overview', {});
    return this.cache.getOrCompute(key, async () => {
      const [clinicsByStatus, subsByStatus] = await Promise.all([
        this.prisma.$queryRaw<RawStatus[]>(Prisma.sql`
          SELECT status, COUNT(*)::int AS count
          FROM clinics
          WHERE deleted_at IS NULL
          GROUP BY status
        `),
        this.prisma.$queryRaw<RawStatus[]>(Prisma.sql`
          SELECT status, COUNT(*)::int AS count
          FROM subscriptions
          WHERE deleted_at IS NULL
          GROUP BY status
        `),
      ]);
      const clinics = clinicsByStatus.map(toStatusCount);
      const subs = subsByStatus.map(toStatusCount);
      return {
        clinics: {
          total: clinics.reduce((a, r) => a + r.count, 0),
          byStatus: clinics,
        },
        subscriptions: {
          active:
            subs.find((s) => s.status === SubscriptionStatus.ACTIVE)?.count ?? 0,
          byStatus: subs,
        },
      };
    });
  }

  // ---- Platforma daromadi (abonent to'lovlari: transactions PAID) ----
  async revenue(query: ReportRangeQueryDto): Promise<PlatformRevenueReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const key = this.cache.buildKey('platform', 'revenue', {
      from: fromDate,
      to: toDate,
      groupBy: query.groupBy,
    });
    return this.cache.getOrCompute(key, async () => {
      const bucket = periodExpr('performed_at', query.groupBy, this.tz);
      const [byPeriodRaw, byProviderRaw] = await Promise.all([
        this.prisma.$queryRaw<RawPeriod[]>(Prisma.sql`
          SELECT ${bucket} AS period,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(amount), 0) AS total
          FROM transactions
          WHERE status = ${TransactionStatus.PAID}
            AND performed_at IS NOT NULL
            AND performed_at >= ${fromDate} AND performed_at < ${toDate}
          GROUP BY period
          ORDER BY period
        `),
        this.prisma.$queryRaw<RawProvider[]>(Prisma.sql`
          SELECT provider,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(amount), 0) AS total
          FROM transactions
          WHERE status = ${TransactionStatus.PAID}
            AND performed_at IS NOT NULL
            AND performed_at >= ${fromDate} AND performed_at < ${toDate}
          GROUP BY provider
          ORDER BY total DESC
        `),
      ]);

      const byProvider: ProviderPoint[] = byProviderRaw.map((r) => ({
        provider: r.provider,
        count: num(r.count),
        total: decStr(r.total),
      }));
      const totalCount = byProvider.reduce((a, r) => a + r.count, 0);
      const totalAmount = byProvider
        .reduce(
          (a, r) => a.plus(new Prisma.Decimal(r.total)),
          new Prisma.Decimal(0),
        )
        .toString();

      return {
        range: { from: fromDate.toISOString(), to: toDate.toISOString(), groupBy: query.groupBy },
        byPeriod: byPeriodRaw.map((r) => ({
          period: formatPeriod(r.period),
          count: num(r.count),
          total: decStr(r.total),
        })),
        byProvider,
        totals: { count: totalCount, total: totalAmount },
      };
    });
  }

  // ---- Obunalar: faol, yaqinda tugaydigan, qarzdor klinikalar ----
  async subscriptions(days: number): Promise<PlatformSubscriptions> {
    const key = this.cache.buildKey('platform', 'subscriptions', { days });
    return this.cache.getOrCompute(key, async () => {
      const activeLike: string[] = [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.PAST_DUE,
      ];
      const debtorStatuses: string[] = [
        InvoiceStatus.UNPAID,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
      ];

      const [byStatusRaw, expiringRaw, debtorsRaw] = await Promise.all([
        this.prisma.$queryRaw<RawStatus[]>(Prisma.sql`
          SELECT status, COUNT(*)::int AS count
          FROM subscriptions
          WHERE deleted_at IS NULL
          GROUP BY status
        `),
        this.prisma.$queryRaw<RawExpiring[]>(Prisma.sql`
          SELECT s.clinic_id, c.name AS clinic_name, s.next_billing_date
          FROM subscriptions s
          JOIN clinics c ON c.id = s.clinic_id
          WHERE s.deleted_at IS NULL
            AND s.status IN (${Prisma.join(activeLike)})
            AND s.next_billing_date >= now()
            AND s.next_billing_date < now() + make_interval(days => ${days})
          ORDER BY s.next_billing_date ASC
          LIMIT 100
        `),
        this.prisma.$queryRaw<RawDebtor[]>(Prisma.sql`
          SELECT i.clinic_id, c.name AS clinic_name,
                 COALESCE(SUM(i.debt_amount), 0) AS total_debt
          FROM invoices i
          JOIN clinics c ON c.id = i.clinic_id
          WHERE i.deleted_at IS NULL
            AND i.debt_amount > 0
            AND i.status IN (${Prisma.join(debtorStatuses)})
          GROUP BY i.clinic_id, c.name
          ORDER BY total_debt DESC
          LIMIT 100
        `),
      ]);

      const byStatus = byStatusRaw.map(toStatusCount);
      const debtorItems: DebtorClinic[] = debtorsRaw.map((r) => ({
        clinicId: r.clinic_id,
        clinicName: r.clinic_name,
        totalDebt: decStr(r.total_debt),
      }));
      const debtTotal = debtorItems
        .reduce(
          (a, r) => a.plus(new Prisma.Decimal(r.totalDebt)),
          new Prisma.Decimal(0),
        )
        .toString();

      return {
        active:
          byStatus.find((s) => s.status === SubscriptionStatus.ACTIVE)?.count ??
          0,
        byStatus,
        expiringSoon: {
          days,
          count: expiringRaw.length,
          items: expiringRaw.map((r) => ({
            clinicId: r.clinic_id,
            clinicName: r.clinic_name,
            nextBillingDate: r.next_billing_date
              ? r.next_billing_date.toISOString()
              : null,
          })),
        },
        debtors: {
          count: debtorItems.length,
          totalDebt: debtTotal,
          items: debtorItems,
        },
      };
    });
  }

  // ---- Eng faol klinikalar (bemor/qabul soni) ----
  async topClinics(query: ReportTopQueryDto): Promise<TopClinicsReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const limit = query.limit ?? 10;
    const key = this.cache.buildKey('platform', 'top-clinics', {
      from: fromDate,
      to: toDate,
      limit,
    });
    return this.cache.getOrCompute(key, async () => {
      const rows = await this.prisma.$queryRaw<RawTopClinic[]>(Prisma.sql`
        SELECT c.id AS clinic_id,
               c.name AS clinic_name,
               (SELECT COUNT(*) FROM patients p
                 WHERE p.clinic_id = c.id AND p.deleted_at IS NULL)::int AS patients,
               (SELECT COUNT(*) FROM appointments a
                 WHERE a.clinic_id = c.id AND a.deleted_at IS NULL
                   AND a.scheduled_at >= ${fromDate}
                   AND a.scheduled_at < ${toDate})::int AS appointments
        FROM clinics c
        WHERE c.deleted_at IS NULL
        ORDER BY appointments DESC, patients DESC
        LIMIT ${limit}
      `);
      return {
        range: { from: fromDate.toISOString(), to: toDate.toISOString(), groupBy: query.groupBy },
        rows: rows.map((r) => ({
          clinicId: r.clinic_id,
          clinicName: r.clinic_name,
          patients: num(r.patients),
          appointments: num(r.appointments),
        })),
      };
    });
  }
}

function toStatusCount(r: RawStatus): StatusCount {
  return { status: r.status, count: num(r.count) };
}

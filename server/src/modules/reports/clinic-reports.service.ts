import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { ReportsConfig } from '../../config/configuration';
import { AppointmentStatus } from '../appointments/constants/appointment.constant';
import { PatientInvoiceStatus } from '../cashier/constants/cashier.constant';
import { ReportsCacheService } from './reports-cache.service';
import { ReportRangeQueryDto, ReportTopQueryDto } from './dto/report-query.dto';
import {
  decStr,
  formatPeriod,
  num,
  percent,
  periodExpr,
  resolveRange,
} from './report-sql.util';

// ---- Javob shakllari (pul har doim string = Decimal, Float EMAS) ----
export interface PeriodPoint {
  period: string;
  count: number;
  total: string;
}
export interface MethodPoint {
  method: string;
  count: number;
  total: string;
}
export interface RangeMeta {
  from: string;
  to: string;
  groupBy: string;
}
export interface RevenueReport {
  range: RangeMeta;
  byPeriod: PeriodPoint[];
  byMethod: MethodPoint[];
  totals: { count: number; total: string };
  debt: { totalDebt: string };
}
export interface StatusCount {
  status: string;
  count: number;
}
export interface PatientFlowReport {
  range: RangeMeta;
  newPatients: { total: number; byPeriod: { period: string; count: number }[] };
  appointments: { total: number; byStatus: StatusCount[] };
  noShow: { count: number; rate: number };
}
export interface DoctorLoadRow {
  doctorId: string;
  doctorName: string | null;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}
export interface DoctorLoadReport {
  range: RangeMeta;
  rows: DoctorLoadRow[];
}
export interface TopServiceRow {
  serviceId: string;
  serviceName: string | null;
  count: number;
  revenue: string;
}
export interface TopServicesReport {
  range: RangeMeta;
  rows: TopServiceRow[];
}

// ---- Raw natija qatorlari ----
interface RawPeriod {
  period: Date;
  count: number;
  total: Prisma.Decimal | string | null;
}
interface RawMethod {
  method: string;
  count: number;
  total: Prisma.Decimal | string | null;
}
interface RawStatus {
  status: string;
  count: number;
}
interface RawDoctor {
  doctor_id: string;
  doctor_name: string | null;
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
}
interface RawTopService {
  service_id: string;
  service_name: string | null;
  count: number;
  revenue: Prisma.Decimal | string | null;
}

/**
 * Klinika darajasidagi hisobotlar (spec 13). TENANT IZOLYATSIYA: clinicId
 * TOKEN'dan keladi (controller `user.clinicId`), so'rov parametridan EMAS —
 * shu sababli boshqa klinika ma'lumotiga kirib bo'lmaydi. Raw SQL'da clinic_id
 * MAJBURIY bog'langan param (extension raw'ni filtrlamaydi).
 *
 * Performance (spec 1.6.B): agregatsiya DB darajasida (GROUP BY), N+1 yo'q,
 * tegishli indekslardan foydalanadi (patient_payments(clinic_id,paid_at),
 * appointments(clinic_id,status,scheduled_at)). Natija cache-aside bilan keshlanadi.
 */
@Injectable()
export class ClinicReportsService {
  private readonly tz: number;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly cache: ReportsCacheService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<ReportsConfig>('reports').tzOffsetMinutes;
  }

  // ---- Daromad ----
  async revenue(
    clinicId: string,
    query: ReportRangeQueryDto,
  ): Promise<RevenueReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const key = this.cache.buildKey(clinicId, 'revenue', {
      from: fromDate,
      to: toDate,
      groupBy: query.groupBy,
    });
    return this.cache.getOrCompute(key, async () => {
      const bucket = periodExpr('paid_at', query.groupBy, this.tz);
      const [byPeriodRaw, byMethodRaw, debtRow] = await Promise.all([
        this.prisma.$queryRaw<RawPeriod[]>(Prisma.sql`
          SELECT ${bucket} AS period,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(amount), 0) AS total
          FROM patient_payments
          WHERE clinic_id = ${clinicId}::uuid
            AND status = 'COMPLETED'
            AND paid_at >= ${fromDate} AND paid_at < ${toDate}
          GROUP BY period
          ORDER BY period
        `),
        this.prisma.$queryRaw<RawMethod[]>(Prisma.sql`
          SELECT method,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(amount), 0) AS total
          FROM patient_payments
          WHERE clinic_id = ${clinicId}::uuid
            AND status = 'COMPLETED'
            AND paid_at >= ${fromDate} AND paid_at < ${toDate}
          GROUP BY method
          ORDER BY total DESC
        `),
        this.prisma.$queryRaw<{ total_debt: Prisma.Decimal | string | null }[]>(
          Prisma.sql`
          SELECT COALESCE(SUM(debt_amount), 0) AS total_debt
          FROM invoices_patient
          WHERE clinic_id = ${clinicId}::uuid
            AND deleted_at IS NULL
            AND status <> ${PatientInvoiceStatus.CANCELLED}
        `,
        ),
      ]);

      const byMethod: MethodPoint[] = byMethodRaw.map((r) => ({
        method: r.method,
        count: num(r.count),
        total: decStr(r.total),
      }));
      const totalCount = byMethod.reduce((a, r) => a + r.count, 0);
      const totalAmount = byMethod
        .reduce(
          (a, r) => a.plus(new Prisma.Decimal(r.total)),
          new Prisma.Decimal(0),
        )
        .toString();

      return {
        range: rangeMeta(fromDate, toDate, query.groupBy),
        byPeriod: byPeriodRaw.map(toPeriodPoint),
        byMethod,
        totals: { count: totalCount, total: totalAmount },
        debt: { totalDebt: decStr(debtRow[0]?.total_debt) },
      };
    });
  }

  // ---- Bemorlar oqimi ----
  async patientFlow(
    clinicId: string,
    query: ReportRangeQueryDto,
  ): Promise<PatientFlowReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const key = this.cache.buildKey(clinicId, 'patient-flow', {
      from: fromDate,
      to: toDate,
      groupBy: query.groupBy,
    });
    return this.cache.getOrCompute(key, async () => {
      const bucket = periodExpr('created_at', query.groupBy, this.tz);
      const [newPatientsRaw, byStatusRaw] = await Promise.all([
        this.prisma.$queryRaw<RawPeriod[]>(Prisma.sql`
          SELECT ${bucket} AS period, COUNT(*)::int AS count, 0 AS total
          FROM patients
          WHERE clinic_id = ${clinicId}::uuid
            AND deleted_at IS NULL
            AND created_at >= ${fromDate} AND created_at < ${toDate}
          GROUP BY period
          ORDER BY period
        `),
        this.prisma.$queryRaw<RawStatus[]>(Prisma.sql`
          SELECT status, COUNT(*)::int AS count
          FROM appointments
          WHERE clinic_id = ${clinicId}::uuid
            AND deleted_at IS NULL
            AND scheduled_at >= ${fromDate} AND scheduled_at < ${toDate}
          GROUP BY status
        `),
      ]);

      const byStatus: StatusCount[] = byStatusRaw.map((r) => ({
        status: r.status,
        count: num(r.count),
      }));
      const apptTotal = byStatus.reduce((a, r) => a + r.count, 0);
      const noShowCount =
        byStatus.find((s) => s.status === AppointmentStatus.NO_SHOW)?.count ??
        0;
      const newPatientsTotal = newPatientsRaw.reduce(
        (a, r) => a + num(r.count),
        0,
      );

      return {
        range: rangeMeta(fromDate, toDate, query.groupBy),
        newPatients: {
          total: newPatientsTotal,
          byPeriod: newPatientsRaw.map((r) => ({
            period: formatPeriod(r.period),
            count: num(r.count),
          })),
        },
        appointments: { total: apptTotal, byStatus },
        noShow: { count: noShowCount, rate: percent(noShowCount, apptTotal) },
      };
    });
  }

  // ---- Shifokorlar yuklamasi ----
  async doctorLoad(
    clinicId: string,
    query: ReportRangeQueryDto,
  ): Promise<DoctorLoadReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const key = this.cache.buildKey(clinicId, 'doctor-load', {
      from: fromDate,
      to: toDate,
    });
    return this.cache.getOrCompute(key, async () => {
      const rows = await this.prisma.$queryRaw<RawDoctor[]>(Prisma.sql`
        SELECT a.doctor_id,
               u.full_name AS doctor_name,
               COUNT(*)::int AS total,
               (COUNT(*) FILTER (WHERE a.status = ${AppointmentStatus.COMPLETED}))::int AS completed,
               (COUNT(*) FILTER (WHERE a.status = ${AppointmentStatus.CANCELLED}))::int AS cancelled,
               (COUNT(*) FILTER (WHERE a.status = ${AppointmentStatus.NO_SHOW}))::int AS no_show
        FROM appointments a
        LEFT JOIN users u ON u.id = a.doctor_id
        WHERE a.clinic_id = ${clinicId}::uuid
          AND a.deleted_at IS NULL
          AND a.scheduled_at >= ${fromDate} AND a.scheduled_at < ${toDate}
        GROUP BY a.doctor_id, u.full_name
        ORDER BY total DESC
      `);
      return {
        range: rangeMeta(fromDate, toDate, query.groupBy),
        rows: rows.map((r) => ({
          doctorId: r.doctor_id,
          doctorName: r.doctor_name,
          total: num(r.total),
          completed: num(r.completed),
          cancelled: num(r.cancelled),
          noShow: num(r.no_show),
        })),
      };
    });
  }

  // ---- Eng ko'p xizmatlar ----
  async topServices(
    clinicId: string,
    query: ReportTopQueryDto,
  ): Promise<TopServicesReport> {
    const { fromDate, toDate } = resolveRange(query.from, query.to);
    const limit = query.limit ?? 10;
    const key = this.cache.buildKey(clinicId, 'top-services', {
      from: fromDate,
      to: toDate,
      limit,
    });
    return this.cache.getOrCompute(key, async () => {
      const rows = await this.prisma.$queryRaw<RawTopService[]>(Prisma.sql`
        SELECT a.service_id,
               s.name AS service_name,
               COUNT(DISTINCT a.id)::int AS count,
               COALESCE(SUM(pi.total_amount), 0) AS revenue
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        LEFT JOIN invoices_patient pi
          ON pi.appointment_id = a.id
         AND pi.deleted_at IS NULL
         AND pi.status <> ${PatientInvoiceStatus.CANCELLED}
        WHERE a.clinic_id = ${clinicId}::uuid
          AND a.deleted_at IS NULL
          AND a.service_id IS NOT NULL
          AND a.scheduled_at >= ${fromDate} AND a.scheduled_at < ${toDate}
        GROUP BY a.service_id, s.name
        ORDER BY count DESC, revenue DESC
        LIMIT ${limit}
      `);
      return {
        range: rangeMeta(fromDate, toDate, query.groupBy),
        rows: rows.map((r) => ({
          serviceId: r.service_id,
          serviceName: r.service_name,
          count: num(r.count),
          revenue: decStr(r.revenue),
        })),
      };
    });
  }
}

function toPeriodPoint(r: RawPeriod): PeriodPoint {
  return {
    period: formatPeriod(r.period),
    count: num(r.count),
    total: decStr(r.total),
  };
}

function rangeMeta(from: Date, to: Date, groupBy: string): RangeMeta {
  return { from: from.toISOString(), to: to.toISOString(), groupBy };
}

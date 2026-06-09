import { Prisma } from '@prisma/client';
import { DEFAULT_RANGE_DAYS, TRUNC_UNIT } from './constants/report.constant';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * from/to (ISO) -> Date oralig'i. Berilmasa: to=hozir, from=to-30kun.
 * Yarim ochiq oraliq: paid_at >= fromDate AND < toDate.
 */
export function resolveRange(
  from?: string,
  to?: string,
): { fromDate: Date; toDate: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  return { fromDate, toDate };
}

/**
 * Mahalliy (klinika vaqti) kun/hafta/oy bucket ifodasi. UTC instant'ni offset
 * bilan mahalliy devor-soatga aylantirib date_trunc qiladi (DST yo'q — O'zbekiston).
 *
 * XAVFSIZLIK: `column` va `unit` — ichki WHITELIST (foydalanuvchi matni EMAS),
 * `offsetMin` — config butun soni. Shuning uchun ularni Prisma.raw bilan inline
 * qilish SQL-injection xavfini tug'dirmaydi. clinic_id/from/to esa bog'langan param.
 */
export function periodExpr(
  column: string,
  groupBy: string,
  offsetMin: number,
): Prisma.Sql {
  const unit = TRUNC_UNIT[groupBy] ?? 'day';
  const off = Math.trunc(offsetMin);
  return Prisma.sql`date_trunc(${Prisma.raw(`'${unit}'`)}, (${Prisma.raw(column)} AT TIME ZONE 'UTC') + make_interval(mins => ${Prisma.raw(String(off))}))`;
}

/** Raw natijadagi pul (numeric/Decimal/string) -> aniq string (Float EMAS). */
export function decStr(v: unknown): string {
  if (v === null || v === undefined) return '0';
  return new Prisma.Decimal(v as Prisma.Decimal.Value).toString();
}

/** Raw natijadagi son (int/bigint) -> JS number. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'bigint' ? Number(v) : Number(v as number);
}

/** date_trunc natijasi (timestamp) -> 'YYYY-MM-DD' (mahalliy bucket sanasi). */
export function formatPeriod(d: Date | string | null): string {
  if (d === null || d === undefined) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

/** Foiz hisobi (0..100, 2 kasr) — bo'luvchi 0 bo'lsa 0. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

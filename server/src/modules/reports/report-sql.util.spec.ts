import { Prisma } from '@prisma/client';
import {
  decStr,
  formatPeriod,
  num,
  percent,
  periodExpr,
  resolveRange,
} from './report-sql.util';

/**
 * Hisobot SQL yordamchilari (sof funksiyalar, DB'siz). Pul aniq (Decimal->string),
 * no-show foizi to'g'ri, bucket ifodasi xavfsiz (whitelist unit).
 */
describe('report-sql.util', () => {
  it('resolveRange: from/to berilsa o`shani, berilmasa oxirgi 30 kun', () => {
    const r = resolveRange('2026-06-01T00:00:00Z', '2026-06-30T00:00:00Z');
    expect(r.fromDate.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.toDate.toISOString()).toBe('2026-06-30T00:00:00.000Z');

    const d = resolveRange();
    const diffDays = (d.toDate.getTime() - d.fromDate.getTime()) / 86400000;
    expect(Math.round(diffDays)).toBe(30);
  });

  it('decStr: numeric/Decimal/null -> aniq string (Float EMAS)', () => {
    expect(decStr(null)).toBe('0');
    expect(decStr('1500000')).toBe('1500000');
    expect(decStr(new Prisma.Decimal('999.50'))).toBe('999.5');
  });

  it('num: bigint/int/null -> number', () => {
    expect(num(null)).toBe(0);
    expect(num(5)).toBe(5);
    expect(num(BigInt(42))).toBe(42);
  });

  it('percent: no-show foizi (2 kasr), bo`luvchi 0 -> 0', () => {
    expect(percent(3, 10)).toBe(30);
    expect(percent(1, 3)).toBe(33.33);
    expect(percent(5, 0)).toBe(0);
  });

  it('formatPeriod: timestamp -> YYYY-MM-DD', () => {
    expect(formatPeriod(new Date('2026-06-01T00:00:00Z'))).toBe('2026-06-01');
    expect(formatPeriod(null)).toBe('');
  });

  it('periodExpr: whitelist unit inline, noma`lum -> day (SQL-injection emas)', () => {
    const sql = periodExpr('paid_at', 'month', 300);
    expect(sql.sql).toContain("date_trunc('month'");
    expect(sql.sql).toContain('paid_at');
    expect(sql.sql).toContain('make_interval(mins => 300)');

    const bad = periodExpr('paid_at', "day'); DROP TABLE x;--", 300);
    expect(bad.sql).toContain("date_trunc('day'"); // whitelist fallback
    expect(bad.sql).not.toContain('DROP');
  });
});

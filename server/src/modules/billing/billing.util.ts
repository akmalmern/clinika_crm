import { Prisma } from '@prisma/client';

/**
 * Pul yordamchilari. QAT'IY: pul hech qachon Float EMAS (spec 1.5) —
 * har doim Prisma.Decimal. Payme tiyinda (1 so'm = 100 tiyin) ishlaydi,
 * Click so'mda. Konvertatsiya shu yerda markazlashtirilgan.
 */

/** Decimal'ni xavfsiz quradi (string | number | Decimal). */
export function toDecimal(
  value: Prisma.Decimal | string | number,
): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** So'm (Decimal) -> tiyin (Decimal, butun). */
export function somToTiyin(amount: Prisma.Decimal): Prisma.Decimal {
  return amount.times(100);
}

/** Tiyin (Payme integer) -> so'm (Decimal). */
export function tiyinToSom(tiyin: number): Prisma.Decimal {
  return new Prisma.Decimal(tiyin).dividedBy(100);
}

/** Ikki pul qiymati tengmi (Decimal taqqoslash — float xatosisiz). */
export function moneyEquals(
  a: Prisma.Decimal | string | number,
  b: Prisma.Decimal | string | number,
): boolean {
  return new Prisma.Decimal(a).equals(new Prisma.Decimal(b));
}

/** Payme integer tiyin invoice qoldig'iga (debt, so'm) tengmi. */
export function tiyinEqualsSom(
  tiyin: number,
  som: Prisma.Decimal | string | number,
): boolean {
  return somToTiyin(new Prisma.Decimal(som)).equals(new Prisma.Decimal(tiyin));
}

/**
 * Invoice raqamini hosil qiladi: INV-YYYYMM-XXXXXX
 * Noyoblik DB partial unique index bilan kafolatlanadi; to'qnashuvda chaqiruvchi
 * yangi suffix bilan qayta urinadi. Suffix — UUID v7'ning oxirgi belgilaridan
 * (tartiblanuvchan, taxminlash qiyin).
 */
export function buildInvoiceNumber(date: Date, suffix: string): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const clean = suffix.replace(/-/g, '').slice(-6).toUpperCase();
  return `INV-${yyyy}${mm}-${clean}`;
}

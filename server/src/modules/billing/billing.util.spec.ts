import { Prisma } from '@prisma/client';
import {
  buildInvoiceNumber,
  moneyEquals,
  somToTiyin,
  tiyinEqualsSom,
  tiyinToSom,
} from './billing.util';

describe('billing.util (pul/tiyin — Float EMAS)', () => {
  it('so`m -> tiyin va aksincha aniq (float xatosisiz)', () => {
    expect(somToTiyin(new Prisma.Decimal('1990.00')).toString()).toBe('199000');
    expect(tiyinToSom(199000).toString()).toBe('1990');
    // 0.1 + 0.2 muammosi bo'lmasligi:
    expect(somToTiyin(new Prisma.Decimal('0.30')).toString()).toBe('30');
  });

  it('moneyEquals Decimal taqqoslash', () => {
    expect(moneyEquals('199000', '199000.00')).toBe(true);
    expect(moneyEquals('199000', '199000.01')).toBe(false);
  });

  it('tiyinEqualsSom: Payme tiyin invoice qoldig`iga teng', () => {
    expect(tiyinEqualsSom(199000, '1990')).toBe(true);
    expect(tiyinEqualsSom(199000, '1990.00')).toBe(true);
    expect(tiyinEqualsSom(199001, '1990')).toBe(false);
  });

  it('buildInvoiceNumber INV-YYYYMM-XXXXXX', () => {
    const num = buildInvoiceNumber(
      new Date('2026-06-05T00:00:00Z'),
      '0190a1b2-c3d4-7e5f-8a9b-abcdef123456',
    );
    expect(num).toMatch(/^INV-202606-[0-9A-F]{6}$/);
    expect(num).toBe('INV-202606-123456');
  });
});

import { Prisma } from '@prisma/client';
import { ClinicReportsService } from './clinic-reports.service';

/**
 * Klinika hisoboti (DB'siz, prisma.$queryRaw mock). DoD:
 *  - Raqamlar to'g'ri (daromad jami, qarz, no-show foizi).
 *  - TENANT IZOLYATSIYA: har bir raw so'rovga clinic_id MAJBURIY bog'lanadi
 *    (boshqa klinika ma'lumotiga kira olmaydi).
 */
describe('ClinicReportsService', () => {
  function makeService(results: unknown[][]) {
    let i = 0;
    const calls: Prisma.Sql[] = [];
    const prisma = {
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        calls.push(sql);
        return Promise.resolve(results[i++] ?? []);
      }),
    };
    // Kesh — passthrough (compute har doim ishlaydi).
    const cache = {
      buildKey: jest.fn(() => 'key'),
      getOrCompute: jest.fn((_k: string, fn: () => Promise<unknown>) => fn()),
    };
    const config = { getOrThrow: jest.fn(() => ({ tzOffsetMinutes: 300 })) };
    const service = new ClinicReportsService(
      prisma as never,
      cache as never,
      config as never,
    );
    return { service, calls };
  }

  it('revenue: jami to`g`ri + clinic_id har so`rovga bog`langan', async () => {
    const { service, calls } = makeService([
      [
        {
          period: new Date('2026-06-01T00:00:00Z'),
          count: 2,
          total: '1500000',
        },
      ],
      [
        { method: 'CASH', count: 1, total: '1000000' },
        { method: 'CARD', count: 1, total: '500000' },
      ],
      [{ total_debt: '7000000' }],
    ]);

    const res = await service.revenue('clinic-A', { groupBy: 'day' });

    expect(res.totals.count).toBe(2);
    expect(res.totals.total).toBe('1500000'); // 1000000 + 500000
    expect(res.byMethod).toHaveLength(2);
    expect(res.debt.totalDebt).toBe('7000000');
    expect(res.byPeriod[0]).toEqual({
      period: '2026-06-01',
      count: 2,
      total: '1500000',
    });

    // TENANT: 3 so'rovning HAMMASIda clinic-A bog'langan
    expect(calls).toHaveLength(3);
    for (const sql of calls) {
      expect(sql.values).toContain('clinic-A');
    }
  });

  it('revenue: boshqa clinicId -> boshqa bog`langan qiymat (izolyatsiya)', async () => {
    const { service, calls } = makeService([[], [], [{ total_debt: '0' }]]);
    await service.revenue('clinic-B', { groupBy: 'day' });
    for (const sql of calls) {
      expect(sql.values).toContain('clinic-B');
      expect(sql.values).not.toContain('clinic-A');
    }
  });

  it('patientFlow: no-show foizi va yangi bemorlar to`g`ri', async () => {
    const { service, calls } = makeService([
      [{ period: new Date('2026-06-01T00:00:00Z'), count: 5, total: 0 }],
      [
        { status: 'COMPLETED', count: 7 },
        { status: 'NO_SHOW', count: 3 },
      ],
    ]);

    const res = await service.patientFlow('clinic-A', {
      groupBy: 'day',
    });

    expect(res.newPatients.total).toBe(5);
    expect(res.appointments.total).toBe(10);
    expect(res.noShow).toEqual({ count: 3, rate: 30 });
    for (const sql of calls) {
      expect(sql.values).toContain('clinic-A');
    }
  });

  it('doctorLoad: qatorlar to`g`ri map qilinadi', async () => {
    const { service, calls } = makeService([
      [
        {
          doctor_id: 'd1',
          doctor_name: 'Dr A',
          total: 4,
          completed: 2,
          cancelled: 1,
          no_show: 1,
        },
      ],
    ]);
    const res = await service.doctorLoad('clinic-A', {
      groupBy: 'day',
    });
    expect(res.rows[0]).toEqual({
      doctorId: 'd1',
      doctorName: 'Dr A',
      total: 4,
      completed: 2,
      cancelled: 1,
      noShow: 1,
    });
    expect(calls[0].values).toContain('clinic-A');
  });

  it('topServices: daromad string (Decimal) + limit bog`langan', async () => {
    const { service, calls } = makeService([
      [
        {
          service_id: 's1',
          service_name: 'Konsultatsiya',
          count: 3,
          revenue: '450000',
        },
      ],
    ]);
    const res = await service.topServices('clinic-A', {
      groupBy: 'day',
      limit: 10,
    });
    expect(res.rows[0]).toEqual({
      serviceId: 's1',
      serviceName: 'Konsultatsiya',
      count: 3,
      revenue: '450000',
    });
    expect(calls[0].values).toContain('clinic-A');
    expect(calls[0].values).toContain(10);
  });
});

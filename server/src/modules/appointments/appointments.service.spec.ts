import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

/**
 * AppointmentsService (DB'siz, mock). DoD: double-booking rad etiladi (overlap +
 * DB exclusion), holat o'tishi state-machine + tarix, COMPLETED -> bemor invoice.
 */
describe('AppointmentsService', () => {
  const FUTURE = '2027-01-15T04:00:00.000Z'; // mahalliy 09:00 (UTC+5)

  function makeService(
    prisma: Record<string, unknown>,
    cashier?: Record<string, unknown>,
  ) {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ tzOffsetMinutes: 300 }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const cashierMock = cashier ?? {
      createInvoiceForAppointment: jest.fn().mockResolvedValue({}),
    };
    const service = new AppointmentsService(
      prisma as never,
      config as never,
      audit as never,
      cashierMock as never,
    );
    return { service, cashier: cashierMock, audit };
  }

  // create() uchun prereq prisma (doctor/patient/schedule o'tadi)
  function createPrisma(txOverrides: {
    overlap?: unknown;
    createImpl?: () => Promise<unknown>;
  }) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      appointment: {
        findFirst: jest.fn().mockResolvedValue(txOverrides.overlap ?? null),
        create: txOverrides.createImpl
          ? jest.fn().mockImplementation(txOverrides.createImpl)
          : jest.fn().mockResolvedValue(apptRow('PENDING')),
      },
      appointmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      clinicMember: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      doctorSchedule: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { startTime: '00:00', endTime: '23:59', slotMinutes: 30 },
          ]),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(tx),
      ),
    };
    return { prisma, tx };
  }

  function apptRow(status: string, service?: unknown) {
    return {
      id: 'a1',
      patientId: 'p1',
      doctorId: 'd1',
      serviceId: service ? 'svc1' : null,
      scheduledAt: new Date(FUTURE),
      endsAt: new Date('2027-01-15T04:30:00.000Z'),
      status,
      notes: null,
      createdAt: new Date(),
      patient: { id: 'p1', fullName: 'Bemor', phone: null },
      service: service ?? null,
    };
  }

  const baseDto = {
    patientId: 'p1',
    doctorId: 'd1',
    scheduledAt: FUTURE,
  };

  it('double-booking: overlap bo`lsa -> Conflict', async () => {
    const { prisma } = createPrisma({ overlap: { id: 'other' } });
    const { service } = makeService(prisma);
    await expect(service.create('cl1', baseDto, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('bo`sh bo`lsa -> qabul yaratiladi (PENDING)', async () => {
    const { prisma, tx } = createPrisma({});
    const { service } = makeService(prisma);
    const res = await service.create('cl1', baseDto, 'u1');
    expect(res.status).toBe('PENDING');
    expect(tx.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('DB exclusion xatosi (parallel) -> Conflict', async () => {
    const { prisma } = createPrisma({
      createImpl: () =>
        Promise.reject(
          new Error(
            'duplicate key ... constraint "appointments_no_overlap" ... 23P01',
          ),
        ),
    });
    const { service } = makeService(prisma);
    await expect(service.create('cl1', baseDto, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('noto`g`ri holat o`tishi -> BadRequest', async () => {
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(apptRow('COMPLETED')),
      },
    };
    const { service } = makeService(prisma);
    await expect(
      service.changeStatus('cl1', 'a1', 'ARRIVED', 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PENDING -> ARRIVED: holat tarixi yoziladi', async () => {
    const tx = {
      appointment: {
        update: jest.fn().mockResolvedValue(apptRow('ARRIVED')),
      },
      appointmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(apptRow('PENDING')),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(tx),
      ),
    };
    const { service } = makeService(prisma);
    const res = await service.changeStatus('cl1', 'a1', 'ARRIVED', 'u1');
    expect(res.status).toBe('ARRIVED');
    const histData = tx.appointmentStatusHistory.create.mock.calls[0][0].data;
    expect(histData.oldStatus).toBe('PENDING');
    expect(histData.newStatus).toBe('ARRIVED');
  });

  it('IN_PROGRESS -> COMPLETED: bemor invoice yaratiladi (xizmat narxi)', async () => {
    const svc = {
      id: 'svc1',
      name: 'Tahlil',
      price: new Prisma.Decimal('80000'),
    };
    const completed = apptRow('COMPLETED', svc);
    const tx = {
      appointment: { update: jest.fn().mockResolvedValue(completed) },
      appointmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(apptRow('IN_PROGRESS', svc)),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(tx),
      ),
    };
    const cashier = {
      createInvoiceForAppointment: jest.fn().mockResolvedValue({}),
    };
    const { service } = makeService(prisma, cashier);
    await service.changeStatus('cl1', 'a1', 'COMPLETED', 'u1');
    expect(cashier.createInvoiceForAppointment).toHaveBeenCalledTimes(1);
    const arg = cashier.createInvoiceForAppointment.mock.calls[0][1];
    expect(arg.amount.toString()).toBe('80000');
    expect(arg.appointmentId).toBe('a1');
  });
});

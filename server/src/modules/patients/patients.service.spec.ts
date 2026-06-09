import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';

/**
 * PatientsService (DB/storage'siz, mock). DoD:
 *  - boshqa klinika bemori ko'rinmaydi (tenant izolyatsiya),
 *  - qidiruv ism/telefon bo'yicha,
 *  - o'chirilganda fayl cleanup chaqiriladi.
 */
describe('PatientsService', () => {
  function build(prisma: Record<string, unknown>) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const files = {
      cleanupOwner: jest.fn().mockResolvedValue({ purged: 0 }),
      upload: jest.fn(),
      listForOwner: jest.fn(),
      remove: jest.fn(),
    };
    // @Optional cleanup undefined -> inline fallback (files.cleanupOwner)
    const service = new PatientsService(
      prisma as never,
      audit as never,
      files as never,
      undefined,
    );
    return { service, audit, files };
  }

  it('boshqa klinika bemori -> NotFound (clinicId filtri bilan)', async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = build(prisma);
    await expect(service.findOne('cl1', 'p-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'p-other', clinicId: 'cl1' }),
      }),
    );
  });

  it('create -> patient.create + audit', async () => {
    const prisma = {
      patient: {
        create: jest.fn().mockResolvedValue({
          id: 'p1',
          fullName: 'Aliyeva',
          birthDate: null,
          gender: 'FEMALE',
          phone: '+998901112233',
          address: null,
          bloodType: null,
          allergies: null,
          avatarUrl: null,
          notes: null,
          createdAt: new Date(),
        }),
      },
    };
    const { service, audit } = build(prisma);
    const res = await service.create('cl1', {
      fullName: 'Aliyeva',
      gender: 'FEMALE',
      phone: '+998901112233',
    });
    expect(res.id).toBe('p1');
    expect(res.avatarFileId).toBeNull();
    expect(prisma.patient.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PATIENT_CREATE' }),
    );
  });

  it('qidiruv -> where.OR (ism/telefon)', async () => {
    const prisma = {
      patient: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const { service } = build(prisma);
    await service.findAll('cl1', {
      page: 1,
      limit: 20,
      skip: 0,
      search: 'ali',
    });
    const where = prisma.patient.findMany.mock.calls[0][0].where;
    expect(where.clinicId).toBe('cl1');
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(2);
  });

  it("o'chirilганда -> soft-delete + fayl cleanup (PATIENT, id, clinicId)", async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', clinicId: 'cl1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const { service, files } = build(prisma);
    await service.remove('cl1', 'p1');
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(files.cleanupOwner).toHaveBeenCalledWith('PATIENT', 'p1', 'cl1');
  });
});

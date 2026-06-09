import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmrService } from './emr.service';
import {
  Permission,
  roleHasPermissions,
} from '../../common/constants/permissions.constant';

/**
 * EmrService (DB/storage'siz, mock). DoD: tenant izolyatsiya, har o'qish audit'ga,
 * faqat tegishli shifokor tahrirlaydi (ownership). + ruxsat matritsasi (CASHIER yo'q).
 */
describe('EmrService', () => {
  function build(prisma: Record<string, unknown>) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const files = {
      listForOwner: jest.fn().mockResolvedValue([]),
      cleanupOwner: jest.fn().mockResolvedValue({ purged: 0 }),
      upload: jest.fn(),
      getSignedUrl: jest.fn(),
    };
    const service = new EmrService(
      prisma as never,
      audit as never,
      files as never,
      undefined,
    );
    return { service, audit, files };
  }

  const doctor = { userId: 'doc1', role: 'DOCTOR' };

  it('createRecord: shifokor o`zi -> doctorId=o`zi, audit', async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      clinicMember: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      medicalRecord: {
        create: jest.fn().mockResolvedValue({
          id: 'r1',
          patientId: 'p1',
          appointmentId: null,
          doctorId: 'doc1',
          complaints: null,
          diagnosis: 'J06.9',
          icdCode: 'J06.9',
          treatment: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };
    const { service, audit } = build(prisma);
    const res = await service.createRecord(
      'cl1',
      { patientId: 'p1', diagnosis: 'J06.9', icdCode: 'J06.9' },
      doctor,
    );
    expect(res.doctorId).toBe('doc1');
    expect(prisma.medicalRecord.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDICAL_RECORD_CREATE' }),
    );
  });

  it('boshqa klinika yozuvi -> NotFound (clinicId filtri)', async () => {
    const prisma = {
      medicalRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = build(prisma);
    await expect(
      service.findRecord('cl1', 'r-other', doctor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medicalRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'r-other', clinicId: 'cl1' }),
      }),
    );
  });

  it('findRecord: O`QISH audit log`ga yoziladi (maxfiylik)', async () => {
    const prisma = {
      medicalRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'r1',
          patientId: 'p1',
          appointmentId: null,
          doctorId: 'doc1',
          complaints: null,
          diagnosis: null,
          icdCode: null,
          treatment: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prescriptions: [],
        }),
      },
    };
    const { service, audit } = build(prisma);
    await service.findRecord('cl1', 'r1', doctor);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDICAL_RECORD_READ',
        entityId: 'r1',
      }),
    );
  });

  it('ownership: boshqa shifokor yozuvini tahrirlay olmaydi -> Forbidden', async () => {
    const prisma = {
      medicalRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', doctorId: 'OTHER' }),
      },
    };
    const { service } = build(prisma);
    await expect(
      service.updateRecord('cl1', 'r1', { diagnosis: 'X' }, doctor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('addPrescription: dori qatori yaratiladi + audit', async () => {
    const prisma = {
      medicalRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', doctorId: 'doc1' }),
      },
      prescriptionItem: {
        create: jest.fn().mockResolvedValue({
          id: 'rx1',
          drugName: 'Paracetamol',
          dosage: '500 mg',
          frequency: null,
          duration: null,
          instructions: null,
          createdAt: new Date(),
        }),
      },
    };
    const { service, audit } = build(prisma);
    const res = await service.addPrescription(
      'cl1',
      'r1',
      { drugName: 'Paracetamol', dosage: '500 mg' },
      doctor,
    );
    expect(res.drugName).toBe('Paracetamol');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRESCRIPTION_ADD' }),
    );
  });

  it('ruxsat matritsasi: CASHIER/RECEPTIONIST EMR ko`ra olmaydi', () => {
    expect(roleHasPermissions('DOCTOR', [Permission.EMR_READ])).toBe(true);
    expect(roleHasPermissions('NURSE', [Permission.EMR_READ])).toBe(true);
    expect(roleHasPermissions('CLINIC_ADMIN', [Permission.EMR_MANAGE])).toBe(
      true,
    );
    expect(roleHasPermissions('CASHIER', [Permission.EMR_READ])).toBe(false);
    expect(roleHasPermissions('RECEPTIONIST', [Permission.EMR_READ])).toBe(
      false,
    );
  });
});

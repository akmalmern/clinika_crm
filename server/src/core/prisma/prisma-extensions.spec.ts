import { applyClinicScope } from './prisma-extensions';
import { TenantStore } from '../tenant/tenant-context';

const clinicUser = (clinicId: string): TenantStore => ({
  requestId: 'r',
  clinicId,
  actorType: 'USER',
  isSuperAdmin: false,
  bypassTenant: false,
});

const superAdmin: TenantStore = {
  requestId: 'r',
  actorType: 'SUPER_ADMIN',
  isSuperAdmin: true,
  bypassTenant: true,
};

describe('applyClinicScope (tenant izolyatsiyasi)', () => {
  it("klinika foydalanuvchisi uchun o'qishda clinic_id majburan qo'shiladi", () => {
    const args = applyClinicScope({
      model: 'ClinicMember',
      operation: 'findMany',
      args: { where: {} },
      store: clinicUser('clinic-A'),
    });
    expect(args.where.clinicId).toBe('clinic-A');
    expect(args.where.deletedAt).toBeNull();
  });

  it("BOSHQA clinic_id berilsa ham o'ziniki bilan ALMASHTIRILADI (A != B)", () => {
    // clinic-A foydalanuvchisi clinic-B ma'lumotini so'rashga urinadi
    const args = applyClinicScope({
      model: 'ClinicMember',
      operation: 'findMany',
      args: { where: { clinicId: 'clinic-B' } },
      store: clinicUser('clinic-A'),
    });
    // Natija: faqat o'z klinikasi (clinic-A) — B ko'rinmaydi
    expect(args.where.clinicId).toBe('clinic-A');
  });

  it("yaratishda clinic_id avtomatik biriktiriladi va id (uuid) qo'shiladi", () => {
    const args = applyClinicScope({
      model: 'ClinicMember',
      operation: 'create',
      args: { data: { userId: 'u1', role: 'DOCTOR' } },
      store: clinicUser('clinic-A'),
    });
    expect(args.data.clinicId).toBe('clinic-A');
    expect(typeof args.data.id).toBe('string');
  });

  it("super admin (bypassTenant) uchun clinic_id qo'shilmaydi", () => {
    const args = applyClinicScope({
      model: 'ClinicMember',
      operation: 'findMany',
      args: { where: {} },
      store: superAdmin,
    });
    expect(args.where.clinicId).toBeUndefined();
    // soft-delete baribir qo'llanadi
    expect(args.where.deletedAt).toBeNull();
  });

  it("soft-delete modelда o'qishda deleted_at IS NULL qo'shiladi (Clinic)", () => {
    const args = applyClinicScope({
      model: 'Clinic',
      operation: 'findMany',
      args: {},
      store: superAdmin,
    });
    expect(args.where.deletedAt).toBeNull();
  });

  it("findUnique'ga teginmaydi (unique where buzilmasin)", () => {
    const args = applyClinicScope({
      model: 'ClinicMember',
      operation: 'findUnique',
      args: { where: { id: 'x' } },
      store: clinicUser('clinic-A'),
    });
    expect(args.where).toEqual({ id: 'x' });
    expect(args.where.clinicId).toBeUndefined();
  });

  it("bypassSoftDelete bo'lsa deleted_at filtri qo'shilmaydi", () => {
    const args = applyClinicScope({
      model: 'Clinic',
      operation: 'findMany',
      args: { where: {} },
      store: { ...superAdmin, bypassSoftDelete: true },
    });
    expect(args.where.deletedAt).toBeUndefined();
  });
});

import { PrismaClient } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { getTenantStore, TenantStore } from '../tenant/tenant-context';

/*
 * Bu fayl Prisma so'rov argumentlarini dinamik (model-agnostik) tarzda
 * o'zgartiradi — `any` bilan ishlash bu yerda muqarrar va ataylab. Shu sababli
 * type-aware "unsafe" qoidalar FAQAT shu fayl uchun o'chiriladi.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * clinic_id ustuniga ega modellar (tenant-scoped). Bu modellarga so'rovlarda
 * avtomatik `clinic_id` filtri qo'llanadi (spec 3-bo'lim, anti-pattern #4:
 * tenant filtrini qo'lda yozma).
 */
export const TENANT_MODELS = new Set<string>([
  'ClinicMember',
  'AuditLog',
  'Subscription',
  'Invoice',
  'Transaction',
  'File',
  'Patient',
  'ServiceCategory',
  'Service',
  'ServicePriceHistory',
  'DoctorSchedule',
  'Appointment',
  'AppointmentStatusHistory',
  'PatientInvoice',
  'PatientPayment',
  'MedicalRecord',
  'PrescriptionItem',
  'TelegramLink',
]);

/**
 * deleted_at (soft-delete) ustuniga ega modellar. O'qishda avtomatik
 * `deleted_at IS NULL` qo'shiladi. AuditLog YO'Q — append-only.
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  'SuperAdmin',
  'Clinic',
  'User',
  'ClinicMember',
  'SubscriptionPlan',
  'Subscription',
  'Invoice',
  'File',
  'Patient',
  'ServiceCategory',
  'Service',
  'DoctorSchedule',
  'Appointment',
  'PatientInvoice',
  'MedicalRecord',
  'PrescriptionItem',
  'TelegramLink',
  // Transaction — moliyaviy ledger, soft-delete YO'Q (append + holat o'zgaradi).
  // ServicePriceHistory, AppointmentStatusHistory, PatientPayment — append-only.
]);

const READ_OPS = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const CREATE_OPS = new Set<string>([
  'create',
  'createMany',
  'createManyAndReturn',
]);
const WRITE_FILTER_OPS = new Set<string>(['updateMany', 'deleteMany']);

/**
 * Create-like operatsiyada `id`ni UUID v7 bilan to'ldiradi (agar berilmagan bo'lsa).
 */
function injectUuid(operation: string, args: any): void {
  if (operation === 'create' || operation === 'upsert') {
    const target = operation === 'create' ? args.data : args.create;
    if (target && typeof target === 'object' && target.id === undefined) {
      target.id = uuidv7();
    }
  } else if (
    operation === 'createMany' ||
    operation === 'createManyAndReturn'
  ) {
    const data = args.data;
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row && typeof row === 'object' && row.id === undefined)
          row.id = uuidv7();
      }
    } else if (data && typeof data === 'object' && data.id === undefined) {
      data.id = uuidv7();
    }
  }
}

/**
 * Klinika CRM qoidalarini bitta operatsiya argumentiga qo'llaydi:
 *   1) UUID v7 inject (create).
 *   2) Soft-delete filtri (o'qishda deleted_at IS NULL).
 *   3) Tenant filtri (clinic_id) — o'qish/yozish/yaratishda.
 *
 * SOF funksiya (DB'siz) — shuning uchun tenant izolyatsiyasini to'g'ridan-to'g'ri
 * unit test qilish mumkin. findUnique'ga TEGINMAYDI (unique where'ga qo'shimcha
 * shart qo'shib bo'lmaydi) — shuning uchun kodda findFirst ishlatiladi.
 */
export function applyClinicScope(params: {
  model?: string;
  operation: string;
  args: any;
  store: TenantStore | undefined;
}): any {
  const { model, operation, store } = params;
  const a = params.args ?? {};

  injectUuid(operation, a);

  const isSoftModel = !!model && SOFT_DELETE_MODELS.has(model);
  const isTenantModel = !!model && TENANT_MODELS.has(model);
  const clinicId = store?.clinicId;
  const tenantActive = isTenantModel && !!clinicId && !store?.bypassTenant;
  const softActive = isSoftModel && !store?.bypassSoftDelete;

  // O'qish -> where ga filtr
  if (READ_OPS.has(operation)) {
    const where = { ...(a.where ?? {}) };
    if (softActive && where.deletedAt === undefined) {
      where.deletedAt = null;
    }
    if (tenantActive) {
      // Tenant'ni MAJBURAN o'ziniki bilan cheklaymiz (boshqa clinic_id berilsa ham).
      where.clinicId = clinicId;
    }
    a.where = where;
  }

  // Filtr bilan yozish -> updateMany/deleteMany where ga tenant
  if (tenantActive && WRITE_FILTER_OPS.has(operation)) {
    a.where = { ...(a.where ?? {}), clinicId };
  }

  // Yaratish -> data ga clinic_id (agar berilmagan bo'lsa)
  if (tenantActive && CREATE_OPS.has(operation)) {
    if (operation === 'create') {
      if (a.data && a.data.clinicId === undefined) a.data.clinicId = clinicId;
    } else {
      const data = a.data;
      if (Array.isArray(data)) {
        for (const row of data) {
          if (row && row.clinicId === undefined) row.clinicId = clinicId;
        }
      } else if (data && data.clinicId === undefined) {
        data.clinicId = clinicId;
      }
    }
  }

  return a;
}

// =============================================================================
// MAYDON DARAJASIDA SHIFRLASH (Phase 9B, encryption at rest)
// =============================================================================
// Nozik maydonlar yozishda shifrlanadi, o'qishda deshifrlanadi — SHAFFOF.
// Ustun TEXT bo'lgani uchun ciphertext O'SHA ustunda saqlanadi (sxema o'zgarmaydi).
// `decrypt` ochiq qiymatni ham o'qiydi -> backfill davomida xavfsiz (expand-contract).

/** Model -> shifrlanadigan maydonlar. FAQAT qidirilmaydigan nozik matn. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  MedicalRecord: ['diagnosis', 'complaints', 'treatment', 'notes'],
  Patient: ['allergies', 'address', 'notes'],
};

/** Shifrlash uchun minimal interfeys (CryptoService bilan mos). */
export interface FieldCipher {
  enabled: boolean;
  encrypt(plain: string): string;
  decrypt(value: string): string;
  isEncrypted(value: unknown): value is string;
}

function encryptValue(cipher: FieldCipher, value: unknown): unknown {
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    !cipher.isEncrypted(value)
  ) {
    return cipher.encrypt(value);
  }
  // Prisma update: `{ set: '...' }` shaklini ham qo'llab-quvvatlaymiz.
  if (value && typeof value === 'object' && 'set' in value) {
    const v = value.set;
    if (typeof v === 'string' && v.length > 0 && !cipher.isEncrypted(v)) {
      return { set: cipher.encrypt(v) };
    }
  }
  return value;
}

/** Yozish argumentidagi (data) nozik maydonlarni shifrlaydi. */
export function encryptWriteData(
  model: string,
  data: Record<string, unknown>,
  cipher: FieldCipher,
): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return;
  for (const f of fields) {
    if (f in data && data[f] != null) {
      data[f] = encryptValue(cipher, data[f]);
    }
  }
}

function encryptArgs(
  model: string,
  operation: string,
  args: any,
  cipher: FieldCipher,
): void {
  if (
    operation === 'create' ||
    operation === 'update' ||
    operation === 'updateMany'
  ) {
    if (args.data && typeof args.data === 'object') {
      if (Array.isArray(args.data)) {
        for (const row of args.data) encryptWriteData(model, row, cipher);
      } else {
        encryptWriteData(model, args.data, cipher);
      }
    }
  } else if (
    operation === 'createMany' ||
    operation === 'createManyAndReturn'
  ) {
    const data = args.data;
    if (Array.isArray(data)) {
      for (const row of data) encryptWriteData(model, row, cipher);
    } else if (data && typeof data === 'object') {
      encryptWriteData(model, data, cipher);
    }
  } else if (operation === 'upsert') {
    if (args.create) encryptWriteData(model, args.create, cipher);
    if (args.update) encryptWriteData(model, args.update, cipher);
  }
}

/** Bitta natija qatoridagi nozik maydonlarni deshifrlaydi (joyida). */
export function decryptRow(
  model: string,
  row: Record<string, unknown>,
  cipher: FieldCipher,
): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !row) return;
  for (const f of fields) {
    const v = row[f];
    if (typeof v === 'string' && cipher.isEncrypted(v)) {
      row[f] = cipher.decrypt(v);
    }
  }
}

function decryptResult(model: string, result: any, cipher: FieldCipher): void {
  if (!result || typeof result !== 'object') return;
  if (Array.isArray(result)) {
    for (const row of result) {
      if (row && typeof row === 'object') decryptRow(model, row, cipher);
    }
  } else {
    decryptRow(model, result, cipher);
  }
}

/**
 * Prisma client'ni Klinika CRM qoidalari bilan kengaytiradi (tenant + soft-delete
 * + UUID v7 + maydon shifrlash). `cipher` berilmasa shifrlash o'tkazib yuboriladi.
 */
export function extendPrismaClient(base: PrismaClient, cipher?: FieldCipher) {
  return base.$extends({
    name: 'clinic-crm-tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = applyClinicScope({
            model,
            operation,
            args,
            store: getTenantStore(),
          });

          // Yozishda shifrlash (model nozik maydonga ega bo'lsa).
          if (cipher?.enabled && model && ENCRYPTED_FIELDS[model]) {
            encryptArgs(model, operation, scoped, cipher);
          }

          const result = await query(scoped);

          // O'qishda deshifrlash.
          if (cipher && model && ENCRYPTED_FIELDS[model]) {
            decryptResult(model, result, cipher);
          }
          return result;
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof extendPrismaClient>;

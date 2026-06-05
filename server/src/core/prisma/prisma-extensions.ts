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
  // Transaction — moliyaviy ledger, soft-delete YO'Q (append + holat o'zgaradi).
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

/**
 * Prisma client'ni Klinika CRM qoidalari bilan kengaytiradi.
 */
export function extendPrismaClient(base: PrismaClient) {
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
          return query(scoped);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof extendPrismaClient>;

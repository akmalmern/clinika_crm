import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Har bir HTTP so'rovi davomida yashaydigan kontekst (request-scoped holat).
 * Tenant izolyatsiyasi, audit va so'rov kuzatuvi shu yerdan o'qiydi.
 *
 * Stateless backend (spec 1.6.C): hech qanday global o'zgaruvchi ishlatilmaydi —
 * har so'rov o'z izolyatsiyalangan store'iga ega (AsyncLocalStorage).
 */
export interface TenantStore {
  requestId: string;
  ip?: string;
  userAgent?: string;

  // Autentifikatsiyadan keyin to'ldiriladi:
  userId?: string;
  clinicId?: string;
  role?: string;
  actorType?: string;
  isSuperAdmin?: boolean;

  /**
   * true bo'lsa — Prisma tenant extension clinic_id filtrini QO'LLAMAYDI.
   * Super admin'ning cross-tenant operatsiyalari uchun.
   */
  bypassTenant?: boolean;

  /**
   * true bo'lsa — soft-delete (deleted_at IS NULL) avtomatik filtri o'chiriladi
   * (masalan, o'chirilgan yozuvlarni ko'rish/tiklash kerak bo'lganda).
   */
  bypassSoftDelete?: boolean;
}

const als = new AsyncLocalStorage<TenantStore>();

/** So'rovni yangi tenant store ichida ishga tushiradi. */
export function runWithTenant<T>(store: TenantStore, callback: () => T): T {
  return als.run(store, callback);
}

/** Joriy store (so'rov ichida bo'lmasa undefined). */
export function getTenantStore(): TenantStore | undefined {
  return als.getStore();
}

/** Joriy store maydonlarini to'ldiradi (mavjud bo'lsa). */
export function patchTenant(patch: Partial<TenantStore>): void {
  const store = als.getStore();
  if (store) Object.assign(store, patch);
}

/** Qisqa yordamchilar. */
export function currentClinicId(): string | undefined {
  return als.getStore()?.clinicId;
}

export function currentUserId(): string | undefined {
  return als.getStore()?.userId;
}

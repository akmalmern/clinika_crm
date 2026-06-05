import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  /** Harakat nomi, masalan: 'AUTH_LOGIN', 'CLINIC_CREATE'. */
  action: string;
  /** Tegishli entity (jadval/resurs) nomi, masalan: 'Clinic'. */
  entity?: string;
}

/**
 * Endpoint muvaffaqiyatli bajarilganda audit_logs'ga yozuv qo'shadi
 * (AuditInterceptor orqali). Keyingi modullar shu dekoratordan foydalanadi.
 *
 * Masalan: @Audit({ action: 'CLINIC_CREATE', entity: 'Clinic' })
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);

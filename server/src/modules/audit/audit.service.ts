import { Injectable, Logger } from '@nestjs/common';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { getTenantStore } from '../../core/tenant/tenant-context';
import { ActorType } from '../../common/constants/roles.constant';

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  // Quyidagilar berilmasa — joriy tenant kontekstidan olinadi:
  userId?: string;
  clinicId?: string;
  actorType?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Audit log servisi (spec 14-modul, immutable append-only).
 * Boshqa modullar muhim harakatlarni shu yerga yozadi: kim, qachon, nima qildi.
 *
 * Audit yozuvi asosiy operatsiyani BLOKLAMASLIGI kerak — shuning uchun xatolik
 * faqat loglanadi, throw qilinmaydi (audit yozilmagani biznes amalni buzmaydi).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  async log(input: AuditInput): Promise<void> {
    const store = getTenantStore();
    try {
      await this.prisma.auditLog.create({
        data: {
          clinicId: input.clinicId ?? store?.clinicId ?? null,
          userId: input.userId ?? store?.userId ?? null,
          actorType: input.actorType ?? store?.actorType ?? ActorType.SYSTEM,
          action: input.action,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          metadata: (input.metadata ?? {}) as object,
          ip: input.ip ?? store?.ip ?? null,
          userAgent: input.userAgent ?? store?.userAgent ?? null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Audit yozib bo'lmadi (action=${input.action}): ${message}`,
      );
    }
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AUDIT_KEY, AuditMeta } from '../../common/decorators/audit.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from './audit.service';

/**
 * @Audit({...}) bilan belgilangan endpoint MUVAFFAQIYATLI bajarilganda
 * audit_logs'ga yozadi. Global interceptor sifatida ulanadi, lekin faqat
 * dekoratorli endpoint'larda ishlaydi.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    return next.handle().pipe(
      tap((result) => {
        // entityId'ni natijadan ehtiyotkorlik bilan ajratib olishga harakat
        let entityId: string | undefined;
        if (
          result &&
          typeof result === 'object' &&
          'id' in (result as Record<string, unknown>)
        ) {
          const id = (result as Record<string, unknown>).id;
          if (typeof id === 'string') entityId = id;
        }

        void this.auditService.log({
          action: meta.action,
          entity: meta.entity,
          entityId,
          userId: user?.userId,
          clinicId: user?.clinicId,
          actorType: user?.actorType,
          metadata: { method: request.method, path: request.url },
        });
      }),
    );
  }
}

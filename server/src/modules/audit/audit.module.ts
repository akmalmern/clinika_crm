import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Audit infratuzilmasi. Global — har qanday modul AuditService'ni inject qila oladi.
 * AuditInterceptor app.module'da global interceptor sifatida ham ulanadi.
 */
@Global()
@Module({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}

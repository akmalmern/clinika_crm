import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration, { ThrottleConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { StorageModule } from './core/storage/storage.module';
import { QueueModule } from './core/queue/queue.module';

import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { PlansModule } from './modules/plans/plans.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { MembersModule } from './modules/members/members.module';
import { BillingModule } from './modules/billing/billing.module';
import { BillingSchedulerModule } from './modules/billing/billing-scheduler.module';
import { FilesModule } from './modules/files/files.module';
import { FilesCleanupModule } from './modules/files/files-cleanup.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ServicesModule } from './modules/services/services.module';
import { CashierModule } from './modules/cashier/cashier.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { EmrModule } from './modules/emr/emr.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationsQueueModule } from './modules/notifications/notifications-queue.module';
import { ReportsModule } from './modules/reports/reports.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ClinicActiveGuard } from './common/guards/clinic-active.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

import { HealthController } from './health/health.controller';

/**
 * BullMQ-ga bog'liq modullar (QueueModule + cron/cleanup) test muhitida
 * YUKLANMAYDI — e2e testlar Redis/BullMQ ulanishini talab qilmasin (DI grafigi
 * mock infra bilan ko'tariladi). Production/dev'da cron + cleanup ishlaydi.
 */
const schedulerModules =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        QueueModule,
        BillingSchedulerModule,
        FilesCleanupModule,
        NotificationsQueueModule,
      ];

@Module({
  imports: [
    // Konfiguratsiya — global, env validatsiyasi bilan (fail-fast).
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // Rate limiting (global throttler).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.getOrThrow<ThrottleConfig>('throttle');
        return { throttlers: [{ ttl: t.ttl, limit: t.limit }] };
      },
    }),

    // Core infratuzilma
    PrismaModule,
    RedisModule,
    StorageModule,
    AuditModule,

    // Funksional modullar
    AuthModule,
    PlansModule,
    ClinicsModule,
    SubscriptionsModule,
    MembersModule,
    BillingModule,
    FilesModule,
    PatientsModule,
    ServicesModule,
    CashierModule,
    AppointmentsModule,
    EmrModule,
    TelegramModule,
    NotificationsModule,
    ReportsModule,
    ...schedulerModules,
  ],
  controllers: [HealthController],
  providers: [
    // Global guard'lar (tartib muhim):
    // throttle -> auth -> clinic-active(suspend) -> roles -> permissions
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ClinicActiveGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    // Global xato filtri
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Global interceptor'lar: javob formati + audit
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
// Eslatma: TenantMiddleware main.ts'da `app.use(tenantContextMiddleware)` orqali
// global Express middleware sifatida ulanadi (NestJS routing'idan oldin ishlaydi).

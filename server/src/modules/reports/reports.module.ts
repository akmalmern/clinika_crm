import { Module } from '@nestjs/common';
import { ClinicReportsController } from './clinic-reports.controller';
import { ClinicReportsService } from './clinic-reports.service';
import { PlatformReportsController } from './platform-reports.controller';
import { PlatformReportsService } from './platform-reports.service';
import { ReportsCacheService } from './reports-cache.service';
import { ReportExportService } from './report-export.service';

/**
 * Hisobot va statistika moduli (Phase 7B, spec 13):
 *  - Klinika darajasi (CLINIC_ADMIN): daromad, bemorlar oqimi, shifokor yuklamasi,
 *    top xizmatlar — tenant izolyatsiya bilan (clinicId TOKEN'dan).
 *  - Platforma (SUPER_ADMIN): klinikalar/obunalar, platforma daromadi, top klinikalar.
 *  - Eksport CSV/PDF + Redis cache-aside (og'ir agregat asosiy bazani sekinlashtirmasin).
 *
 * RedisService (@Global) ReportsCacheService'ga inject bo'ladi; PrismaModule
 * @Global. Shu sababli bu yerda qo'shimcha import shart emas.
 */
@Module({
  controllers: [ClinicReportsController, PlatformReportsController],
  providers: [
    ClinicReportsService,
    PlatformReportsService,
    ReportsCacheService,
    ReportExportService,
  ],
  exports: [ClinicReportsService, PlatformReportsService],
})
export class ReportsModule {}

import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import { PlatformReportsService } from './platform-reports.service';
import { ReportExportService, ExportTable } from './report-export.service';
import {
  PlatformSubsQueryDto,
  ReportExportQueryDto,
  ReportRangeQueryDto,
  ReportTopQueryDto,
} from './dto/report-query.dto';

/**
 * Platforma global statistikasi (spec 4/13) — FAQAT SUPER_ADMIN (PLATFORM_STATS).
 * Tenant filtridan mustasno (barcha klinikalar). Eksport `/export` route'larida.
 */
@ApiTags('reports (platform / super-admin)')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Permissions(Permission.PLATFORM_STATS)
@Controller('super-admin/reports')
export class PlatformReportsController {
  constructor(
    private readonly reports: PlatformReportsService,
    private readonly exporter: ReportExportService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Klinikalar va obunalar holati (umumiy)' })
  overview() {
    return this.reports.overview();
  }

  @Get('revenue')
  @ApiOperation({
    summary: "Platforma daromadi (abonent to'lovlari): davr + provayder",
  })
  revenue(@Query() query: ReportRangeQueryDto) {
    return this.reports.revenue(query);
  }

  @Get('revenue/export')
  @ApiOperation({ summary: 'Platforma daromadini eksport (csv/pdf)' })
  async revenueExport(
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.revenue(query);
    const table: ExportTable = {
      title: 'Platforma daromadi',
      headers: ['Davr', 'Tranzaksiya', 'Summa'],
      rows: report.byPeriod.map((p) => [p.period, p.count, p.total]),
    };
    this.send(res, query.format, table, 'platforma-daromad');
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Obunalar: faol, yaqinda tugaydigan, qarzdor klinikalar',
  })
  subscriptions(@Query() query: PlatformSubsQueryDto) {
    return this.reports.subscriptions(query.days);
  }

  @Get('top-clinics')
  @ApiOperation({ summary: 'Eng faol klinikalar (bemor/qabul soni)' })
  topClinics(@Query() query: ReportTopQueryDto) {
    return this.reports.topClinics(query);
  }

  @Get('top-clinics/export')
  @ApiOperation({ summary: 'Eng faol klinikalarni eksport (csv/pdf)' })
  async topClinicsExport(
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.topClinics(query);
    const table: ExportTable = {
      title: 'Eng faol klinikalar',
      headers: ['Klinika', 'Bemorlar', 'Qabullar'],
      rows: report.rows.map((r) => [
        r.clinicName ?? r.clinicId,
        r.patients,
        r.appointments,
      ]),
    };
    this.send(res, query.format, table, 'top-klinikalar');
  }

  // ---- private ----
  private send(
    res: Response,
    format: string,
    table: ExportTable,
    baseName: string,
  ): void {
    const out = this.exporter.build(format, table, baseName);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.buffer);
  }
}

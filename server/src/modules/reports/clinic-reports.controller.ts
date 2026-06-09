import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ClinicReportsService } from './clinic-reports.service';
import { ReportExportService, ExportTable } from './report-export.service';
import {
  ReportExportQueryDto,
  ReportRangeQueryDto,
  ReportTopQueryDto,
} from './dto/report-query.dto';

/**
 * Klinika hisobotlari (spec 13) — FAQAT CLINIC_ADMIN (REPORT_READ). Tenant
 * izolyatsiya: clinicId TOKEN'dan (`user.clinicId`), so'rovdan EMAS — boshqa
 * klinika ma'lumoti ochilmaydi. Eksport (CSV/PDF) alohida `/export` route'larida.
 */
@ApiTags('reports (clinic)')
@ApiBearerAuth()
@Roles(Role.CLINIC_ADMIN)
@Permissions(Permission.REPORT_READ)
@Controller('clinic/reports')
export class ClinicReportsController {
  constructor(
    private readonly reports: ClinicReportsService,
    private readonly exporter: ReportExportService,
  ) {}

  // ---- Daromad ----
  @Get('revenue')
  @ApiOperation({
    summary: "Daromad (bemor to'lovlari): davr + to'lov usuli + qarz",
  })
  revenue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reports.revenue(user.clinicId!, query);
  }

  @Get('revenue/export')
  @ApiOperation({ summary: 'Daromad hisobotini eksport (csv/pdf)' })
  async revenueExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.revenue(user.clinicId!, query);
    const table: ExportTable = {
      title: 'Daromad hisoboti',
      headers: ['Davr', 'Toolovlar soni', 'Summa'],
      rows: report.byPeriod.map((p) => [p.period, p.count, p.total]),
    };
    this.send(res, query.format, table, 'daromad');
  }

  // ---- Bemorlar oqimi ----
  @Get('patient-flow')
  @ApiOperation({
    summary: 'Bemorlar oqimi: yangi bemorlar, qabullar, no-show foizi',
  })
  patientFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reports.patientFlow(user.clinicId!, query);
  }

  @Get('patient-flow/export')
  @ApiOperation({ summary: 'Bemorlar oqimini eksport (csv/pdf)' })
  async patientFlowExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.patientFlow(user.clinicId!, query);
    const table: ExportTable = {
      title: 'Bemorlar oqimi (qabul statuslari)',
      headers: ['Status', 'Soni'],
      rows: report.appointments.byStatus.map((s) => [s.status, s.count]),
    };
    this.send(res, query.format, table, 'bemorlar-oqimi');
  }

  // ---- Shifokorlar yuklamasi ----
  @Get('doctor-load')
  @ApiOperation({
    summary: 'Shifokorlar yuklamasi: qabullar, yakunlangan/bekor/no-show',
  })
  doctorLoad(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reports.doctorLoad(user.clinicId!, query);
  }

  @Get('doctor-load/export')
  @ApiOperation({ summary: 'Shifokorlar yuklamasini eksport (csv/pdf)' })
  async doctorLoadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.doctorLoad(user.clinicId!, query);
    const table: ExportTable = {
      title: 'Shifokorlar yuklamasi',
      headers: ['Shifokor', 'Jami', 'Yakunlangan', 'Bekor', 'No-show'],
      rows: report.rows.map((r) => [
        r.doctorName ?? r.doctorId,
        r.total,
        r.completed,
        r.cancelled,
        r.noShow,
      ]),
    };
    this.send(res, query.format, table, 'shifokor-yuklamasi');
  }

  // ---- Eng ko'p xizmatlar ----
  @Get('top-services')
  @ApiOperation({ summary: "Eng ko'p xizmatlar (soni + daromadi)" })
  topServices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportTopQueryDto,
  ) {
    return this.reports.topServices(user.clinicId!, query);
  }

  @Get('top-services/export')
  @ApiOperation({ summary: "Eng ko'p xizmatlarni eksport (csv/pdf)" })
  async topServicesExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.topServices(user.clinicId!, query);
    const table: ExportTable = {
      title: 'Eng kop xizmatlar',
      headers: ['Xizmat', 'Soni', 'Daromad'],
      rows: report.rows.map((r) => [
        r.serviceName ?? r.serviceId,
        r.count,
        r.revenue,
      ]),
    };
    this.send(res, query.format, table, 'top-xizmatlar');
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

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import {
  ALL_EXPORT_FORMATS,
  ALL_REPORT_GROUP_BY,
  ExportFormat,
  ReportGroupBy,
} from '../constants/report.constant';

/**
 * Hisobot sana oralig'i + guruhlash filtri (spec 13). from/to — ISO. Berilmasa
 * servis oxirgi 30 kunni oladi. groupBy — kun/hafta/oy (mahalliy vaqt bo'yicha).
 */
export class ReportRangeQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish (ISO) — >= (UTC instant)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash (ISO) — < (UTC instant)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ALL_REPORT_GROUP_BY, default: ReportGroupBy.DAY })
  @IsOptional()
  @IsIn(ALL_REPORT_GROUP_BY)
  groupBy: string = ReportGroupBy.DAY;
}

/** Top ro'yxat (eng ko'p xizmat/klinika) — oraliq + limit. */
export class ReportTopQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

/** Eksport (CSV/PDF) — oraliq + limit + format. */
export class ReportExportQueryDto extends ReportTopQueryDto {
  @ApiPropertyOptional({ enum: ALL_EXPORT_FORMATS, default: ExportFormat.CSV })
  @IsOptional()
  @IsIn(ALL_EXPORT_FORMATS)
  format: string = ExportFormat.CSV;
}

/** Platforma obunalar hisoboti — "yaqinda tugaydi" oynasi (kun). */
export class PlatformSubsQueryDto {
  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 7;
}

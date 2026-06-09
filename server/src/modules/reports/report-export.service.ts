import { Injectable } from '@nestjs/common';
import { PdfLine, renderSimplePdf } from '../../common/utils/simple-pdf';
import { ExportFormat } from './constants/report.constant';

export type CellValue = string | number;

export interface ExportTable {
  title: string;
  headers: string[];
  rows: CellValue[][];
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

/** UTF-8 BOM — Excel CSV'ni to'g'ri (UTF-8) o'qishi uchun. */
const UTF8_BOM = '﻿';

/**
 * Hisobot eksporti (spec 13): CSV yoki PDF. CSV — Excel/Sheets bilan ochiladi
 * (UTF-8 BOM + RFC-4180 qochirish). PDF — tashqi kutubxonasiz simple-pdf orqali.
 * Pul allaqachon string (Decimal) bo'lib keladi — bu yerda hisob-kitob YO'Q.
 */
@Injectable()
export class ReportExportService {
  build(format: string, table: ExportTable, baseName: string): ExportResult {
    if (format === ExportFormat.PDF) {
      return {
        buffer: this.pdf(table),
        contentType: 'application/pdf',
        fileName: `${baseName}.pdf`,
      };
    }
    return {
      buffer: this.csv(table),
      contentType: 'text/csv; charset=utf-8',
      fileName: `${baseName}.csv`,
    };
  }

  /** RFC-4180 CSV + UTF-8 BOM (Excel kirill/lotinni to'g'ri o'qishi uchun). */
  csv(table: ExportTable): Buffer {
    const lines = [table.headers, ...table.rows]
      .map((row) => row.map((c) => csvCell(c)).join(','))
      .join('\r\n');
    return Buffer.from(UTF8_BOM + lines, 'utf8');
  }

  /** Oddiy bir sahifali jadval PDF (sarlavha + ustunlar + qatorlar). */
  pdf(table: ExportTable): Buffer {
    const left = 40;
    const top = 800;
    const lineHeight = 18;
    const cols = table.headers.length;
    const colWidth = (595 - left * 2) / Math.max(1, cols);

    const lines: PdfLine[] = [];
    lines.push({ x: left, y: top, size: 14, text: table.title });

    let y = top - lineHeight * 1.6;
    // Sarlavha qatori
    table.headers.forEach((h, i) => {
      lines.push({ x: left + i * colWidth, y, size: 10, text: clip(h, colWidth) });
    });
    y -= lineHeight;

    for (const row of table.rows) {
      if (y < 40) break; // sahifadan tashqariga chiqmasin (to'liq pagination — Phase 9)
      row.forEach((cell, i) => {
        lines.push({
          x: left + i * colWidth,
          y,
          size: 9,
          text: clip(String(cell), colWidth),
        });
      });
      y -= lineHeight;
    }

    return renderSimplePdf(lines);
  }
}

/** CSV katakni qochirish: ", ", '"' yoki yangi qatordan biri bo'lsa qo'shtirnoq. */
function csvCell(v: CellValue): string {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Matnni ustun kengligiga (taxminiy) sig'dirish — Helvetica ~5pt/belgi. */
function clip(s: string, width: number): string {
  const maxChars = Math.max(4, Math.floor(width / 5));
  return s.length > maxChars ? s.slice(0, maxChars - 2) + '..' : s;
}

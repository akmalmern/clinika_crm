import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type InvoiceDetailed = Prisma.InvoiceGetPayload<{
  include: { clinic: true; subscription: { include: { plan: true } } };
}>;

interface PdfLine {
  x: number;
  y: number;
  size: number;
  text: string;
}

/**
 * Hisob-faktura PDF eksporti (spec 5.5). Tashqi kutubxonaga BOG'LIQ EMAS —
 * minimal, to'g'ri PDF 1.4 hujjati standart Helvetica shrifti bilan quriladi.
 * (To'liq Unicode/embedded shrift — Phase 9 yaxshilanishi.)
 */
@Injectable()
export class InvoicePdfService {
  buildFileName(invoiceNumber: string): string {
    return `${invoiceNumber}.pdf`;
  }

  build(invoice: InvoiceDetailed): Buffer {
    const lines: PdfLine[] = [];
    let y = 800;
    const left = 50;
    const add = (text: string, size = 12, dy = 22): void => {
      lines.push({ x: left, y, size, text });
      y -= dy;
    };

    add('INVOICE / HISOB-FAKTURA', 20, 34);
    add(`Number: ${invoice.invoiceNumber}`, 12);
    add(`Date: ${fmtDate(invoice.createdAt)}`, 12);
    add(`Due date: ${fmtDate(invoice.dueDate)}`, 12);
    add('', 12, 10);

    add('Clinic / Klinika:', 13, 20);
    add(`  ${invoice.clinic?.name ?? '-'}`, 12);
    if (invoice.clinic?.phone) add(`  Phone: ${invoice.clinic.phone}`, 12);
    if (invoice.clinic?.email) add(`  Email: ${invoice.clinic.email}`, 12);
    add('', 12, 10);

    if (invoice.subscription?.plan) {
      add('Subscription / Obuna:', 13, 20);
      add(`  Plan: ${invoice.subscription.plan.name}`, 12);
      add(`  Cycle: ${invoice.subscription.plan.billingCycle}`, 12);
      if (invoice.periodStart && invoice.periodEnd) {
        add(
          `  Period: ${fmtDate(invoice.periodStart)} - ${fmtDate(invoice.periodEnd)}`,
          12,
        );
      }
      add('', 12, 10);
    }

    add('Amounts / Summalar:', 13, 20);
    add(`  Total:  ${money(invoice.totalAmount)} ${invoice.currency}`, 12);
    add(`  Paid:   ${money(invoice.paidAmount)} ${invoice.currency}`, 12);
    add(`  Debt:   ${money(invoice.debtAmount)} ${invoice.currency}`, 12);
    add(`  Status: ${invoice.status}`, 12);
    if (invoice.paidAt) add(`  Paid at: ${fmtDate(invoice.paidAt)}`, 12);

    return this.render(lines);
  }

  /** PDF obyektlarini xref ofsetlari bilan to'g'ri yig'adi (latin1, 1 belgi = 1 bayt). */
  private render(lines: PdfLine[]): Buffer {
    const content = lines
      .filter((l) => l.text.length > 0)
      .map(
        (l) =>
          `BT /F1 ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm (${escapePdf(toLatin1(l.text))}) Tj ET`,
      )
      .join('\n');

    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    const count = objects.length + 1; // +1 = bo'sh (0) yozuv
    pdf += `xref\n0 ${count}\n`;
    pdf += '0000000000 65535 f \n';
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
  }
}

function escapePdf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Helvetica (WinAnsi) latin1 dan tashqari belgilarni '?' bilan almashtiradi. */
function toLatin1(s: string): string {
  let out = '';
  for (const ch of s) {
    out += ch.charCodeAt(0) <= 0xff ? ch : '?';
  }
  return out;
}

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

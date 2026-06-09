import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PdfLine, renderSimplePdf } from '../../common/utils/simple-pdf';

type RecordWithRx = Prisma.MedicalRecordGetPayload<{
  include: { patient: true; prescriptions: true };
}>;
type ClinicRow = Prisma.ClinicGetPayload<object> | null;

/** Retsept (PDF) — spec 7.7. Tashqi kutubxonasiz (common/simple-pdf). */
@Injectable()
export class PrescriptionPdfService {
  buildFileName(recordId: string): string {
    return `retsept-${recordId.slice(0, 8)}.pdf`;
  }

  build(record: RecordWithRx, clinic: ClinicRow): Buffer {
    const lines: PdfLine[] = [];
    let y = 800;
    const add = (text: string, size = 12, dy = 20): void => {
      lines.push({ x: 50, y, size, text });
      y -= dy;
    };

    add('RETSEPT / PRESCRIPTION', 20, 32);
    add(`Klinika: ${clinic?.name ?? '-'}`, 12);
    if (clinic?.phone) add(`Tel: ${clinic.phone}`, 12);
    add(`Sana: ${fmt(record.createdAt)}`, 12);
    add('', 12, 8);

    add('Bemor / Patient:', 13, 18);
    add(`  ${record.patient?.fullName ?? '-'}`, 12);
    if (record.diagnosis) add(`Tashxis: ${record.diagnosis}`, 12, 22);
    if (record.icdCode) add(`ICD-10: ${record.icdCode}`, 12);
    add('', 12, 8);

    add('Dorilar / Medications:', 13, 20);
    if (record.prescriptions.length === 0) {
      add('  (retsept bo`sh)', 11);
    } else {
      let n = 1;
      for (const rx of record.prescriptions) {
        const parts = [rx.dosage, rx.frequency, rx.duration]
          .filter((p) => p)
          .join(', ');
        add(`  ${n}. ${rx.drugName}${parts ? ' - ' + parts : ''}`, 12, 18);
        if (rx.instructions) add(`     (${rx.instructions})`, 10, 16);
        n++;
      }
    }

    return renderSimplePdf(lines);
  }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

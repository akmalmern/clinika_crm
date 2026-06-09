import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PdfLine, renderSimplePdf } from '../../common/utils/simple-pdf';

type ReceiptPayment = Prisma.PatientPaymentGetPayload<{
  include: { invoice: { include: { patient: true } } };
}>;
type ClinicRow = Prisma.ClinicGetPayload<object> | null;

/** To'lov cheki (PDF) — spec 7.9. Tashqi kutubxonasiz (common/simple-pdf). */
@Injectable()
export class PatientReceiptPdfService {
  buildFileName(paymentId: string): string {
    return `receipt-${paymentId.slice(0, 8)}.pdf`;
  }

  build(payment: ReceiptPayment, clinic: ClinicRow): Buffer {
    const inv = payment.invoice;
    const lines: PdfLine[] = [];
    let y = 800;
    const add = (text: string, size = 12, dy = 22): void => {
      lines.push({ x: 50, y, size, text });
      y -= dy;
    };

    add('TO`LOV CHEKI / RECEIPT', 20, 34);
    add(`Klinika: ${clinic?.name ?? '-'}`, 12);
    if (clinic?.phone) add(`Tel: ${clinic.phone}`, 12);
    add(`Chek #: ${payment.id}`, 11);
    add(`Sana: ${fmt(payment.paidAt)}`, 12);
    add('', 12, 10);

    add('Bemor / Patient:', 13, 20);
    add(`  ${inv.patient?.fullName ?? '-'}`, 12);
    if (inv.patient?.phone) add(`  Tel: ${inv.patient.phone}`, 12);
    add('', 12, 10);

    add('To`lov / Payment:', 13, 20);
    add(`  Summa: ${money(payment.amount)} ${inv.currency}`, 12);
    add(`  Usul: ${payment.method}`, 12);
    add('', 12, 10);

    add('Hisob-faktura / Invoice:', 13, 20);
    add(`  Jami:   ${money(inv.totalAmount)} ${inv.currency}`, 12);
    add(`  Tolangan: ${money(inv.paidAmount)} ${inv.currency}`, 12);
    add(`  Qarz:   ${money(inv.debtAmount)} ${inv.currency}`, 12);
    add(`  Holat:  ${inv.status}`, 12);

    return renderSimplePdf(lines);
  }
}

function money(v: Prisma.Decimal): string {
  return v.toFixed(2);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

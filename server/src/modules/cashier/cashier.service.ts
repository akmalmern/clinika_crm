import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { AuditService } from '../audit/audit.service';
import { PatientInvoiceStatus } from './constants/cashier.constant';
import { CreatePatientInvoiceDto } from './dto/create-patient-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPatientInvoicesQueryDto } from './dto/list-patient-invoices-query.dto';

type InvoiceRow = Prisma.PatientInvoiceGetPayload<object>;
type PaymentRow = Prisma.PatientPaymentGetPayload<object>;

export interface PatientInvoiceResponse {
  id: string;
  patientId: string;
  appointmentId: string | null;
  totalAmount: string;
  paidAmount: string;
  debtAmount: string;
  currency: string;
  status: string;
  createdAt: Date;
}

export interface PatientPaymentResponse {
  id: string;
  patientInvoiceId: string;
  amount: string;
  method: string;
  status: string;
  paidAt: Date;
  cashierId: string | null;
}

export interface PayResult {
  payment: PatientPaymentResponse;
  invoice: PatientInvoiceResponse;
}

export interface InvoiceForAppointmentInput {
  patientId: string;
  appointmentId: string;
  amount: Prisma.Decimal;
  currency?: string;
}

/**
 * Kassa (spec 7.9) — BEMOR to'lovi (abonent to'lovidan ALOHIDA). Qisman to'lov:
 * har patient_payment'da paid oshadi, debt kamayadi, status UNPAID->PARTIAL->PAID.
 * Ortiqcha to'lov rad etiladi. Tenant izolyatsiya (clinicId TOKEN'dan).
 */
@Injectable()
export class CashierService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
  ) {}

  /** Qabul yakunlanганда invoice yaratadi (idempotent — qabulга bitta invoice). */
  async createInvoiceForAppointment(
    clinicId: string,
    input: InvoiceForAppointmentInput,
  ): Promise<InvoiceRow> {
    const existing = await this.prisma.patientInvoice.findFirst({
      where: {
        clinicId,
        appointmentId: input.appointmentId,
        deletedAt: null,
        status: { not: PatientInvoiceStatus.CANCELLED },
      },
    });
    if (existing) return existing;

    const invoice = await this.prisma.patientInvoice.create({
      data: {
        clinicId,
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        totalAmount: input.amount,
        paidAmount: new Prisma.Decimal(0),
        debtAmount: input.amount,
        currency: input.currency ?? 'UZS',
        status: PatientInvoiceStatus.UNPAID,
      },
    });
    await this.auditService.log({
      action: 'PATIENT_INVOICE_CREATE',
      entity: 'PatientInvoice',
      entityId: invoice.id,
      clinicId,
      metadata: {
        appointmentId: input.appointmentId,
        amount: input.amount.toString(),
      },
    });
    return invoice;
  }

  async createInvoice(
    clinicId: string,
    dto: CreatePatientInvoiceDto,
    userId: string,
  ): Promise<PatientInvoiceResponse> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('amount musbat bo`lishi kerak');
    }
    await this.assertPatient(clinicId, dto.patientId);

    const invoice = await this.prisma.patientInvoice.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        totalAmount: amount,
        paidAmount: new Prisma.Decimal(0),
        debtAmount: amount,
        status: PatientInvoiceStatus.UNPAID,
        notes: dto.notes,
      },
    });
    await this.auditService.log({
      action: 'PATIENT_INVOICE_CREATE',
      entity: 'PatientInvoice',
      entityId: invoice.id,
      clinicId,
      userId,
      metadata: { amount: dto.amount, manual: true },
    });
    return toInvoiceResponse(invoice);
  }

  async findAllInvoices(
    clinicId: string,
    query: ListPatientInvoicesQueryDto,
  ): Promise<Paginated<PatientInvoiceResponse>> {
    const where: Prisma.PatientInvoiceWhereInput = {
      clinicId,
      deletedAt: null,
    };
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      this.prisma.patientInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.patientInvoice.count({ where }),
    ]);
    return {
      items: rows.map(toInvoiceResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findInvoice(
    clinicId: string,
    id: string,
  ): Promise<PatientInvoiceResponse & { payments: PatientPaymentResponse[] }> {
    const invoice = await this.prisma.patientInvoice.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { payments: { orderBy: { paidAt: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return {
      ...toInvoiceResponse(invoice),
      payments: invoice.payments.map(toPaymentResponse),
    };
  }

  /** Qisman/to'liq to'lov. Ortiqcha to'lov rad etiladi. Atomik. */
  async pay(
    clinicId: string,
    invoiceId: string,
    dto: CreatePaymentDto,
    cashierId: string,
  ): Promise<PayResult> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('amount musbat bo`lishi kerak');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.patientInvoice.findFirst({
        where: { id: invoiceId, clinicId, deletedAt: null },
      });
      if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
      if (invoice.status === PatientInvoiceStatus.CANCELLED) {
        throw new ConflictException(
          'Bekor qilingan hisob-fakturaga to`lov yo`q',
        );
      }
      if (invoice.status === PatientInvoiceStatus.PAID) {
        throw new ConflictException('Hisob-faktura allaqachon to`langan');
      }
      // ORTIQCHA TO'LOV rad etiladi
      if (amount.greaterThan(invoice.debtAmount)) {
        throw new BadRequestException(
          `To'lov qoldiqdan (${invoice.debtAmount.toString()}) oshmasligi kerak`,
        );
      }

      const newPaid = invoice.paidAmount.plus(amount);
      const newDebt = invoice.totalAmount.minus(newPaid);
      const status = newDebt.lessThanOrEqualTo(0)
        ? PatientInvoiceStatus.PAID
        : PatientInvoiceStatus.PARTIAL;

      const payment = await tx.patientPayment.create({
        data: {
          clinicId,
          patientInvoiceId: invoice.id,
          patientId: invoice.patientId,
          amount,
          method: dto.method,
          cashierId,
          paidAt: new Date(),
        },
      });
      const updatedInvoice = await tx.patientInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          debtAmount: newDebt.lessThan(0) ? new Prisma.Decimal(0) : newDebt,
          status,
        },
      });
      return { payment, invoice: updatedInvoice };
    });

    await this.auditService.log({
      action: 'PATIENT_PAYMENT',
      entity: 'PatientInvoice',
      entityId: invoiceId,
      clinicId,
      userId: cashierId,
      metadata: {
        amount: dto.amount,
        method: dto.method,
        paymentId: result.payment.id,
        invoiceStatus: result.invoice.status,
      },
    });

    return {
      payment: toPaymentResponse(result.payment),
      invoice: toInvoiceResponse(result.invoice),
    };
  }

  /** Chek uchun to'liq ma'lumot (payment + invoice + bemor + klinika). */
  async getReceiptData(clinicId: string, paymentId: string) {
    const payment = await this.prisma.patientPayment.findFirst({
      where: { id: paymentId, clinicId },
      include: { invoice: { include: { patient: true } } },
    });
    if (!payment) throw new NotFoundException('To`lov topilmadi');
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: clinicId },
    });
    return { payment, clinic };
  }

  // ---- private ----

  private async assertPatient(
    clinicId: string,
    patientId: string,
  ): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
    });
    if (!patient) throw new BadRequestException('Bemor topilmadi');
  }
}

export function toInvoiceResponse(i: InvoiceRow): PatientInvoiceResponse {
  return {
    id: i.id,
    patientId: i.patientId,
    appointmentId: i.appointmentId,
    totalAmount: i.totalAmount.toString(),
    paidAmount: i.paidAmount.toString(),
    debtAmount: i.debtAmount.toString(),
    currency: i.currency,
    status: i.status,
    createdAt: i.createdAt,
  };
}

export function toPaymentResponse(p: PaymentRow): PatientPaymentResponse {
  return {
    id: p.id,
    patientInvoiceId: p.patientInvoiceId,
    amount: p.amount.toString(),
    method: p.method,
    status: p.status,
    paidAt: p.paidAt,
    cashierId: p.cashierId,
  };
}

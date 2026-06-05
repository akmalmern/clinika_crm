import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { ActorType } from '../../../common/constants/roles.constant';
import { AuditService } from '../../audit/audit.service';
import { InvoiceStatus, PaymentProvider } from '../constants/billing.constant';
import { ManualPaymentDto } from '../dto/manual-payment.dto';
import {
  ConfirmPaymentResult,
  PaymentApplicationService,
} from './payment-application.service';

/**
 * MANUAL to'lov (spec 5.4): faqat SUPER_ADMIN qo'lda naqd/bank to'lovini qayd
 * etadi. Natija Payme/Click bilan BIR XIL (PaymentApplication-> invoice PAID/PARTIAL,
 * to'liq bo'lsa obuna uzayadi, SUSPENDED->ACTIVE). provider='MANUAL',
 * confirmed_by=admin id. Audit MAJBURIY (kim/qachon/qancha/qaysi usul).
 */
@Injectable()
export class ManualPaymentService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly payments: PaymentApplicationService,
    private readonly auditService: AuditService,
  ) {}

  async record(
    dto: ManualPaymentDto,
    adminId: string,
  ): Promise<ConfirmPaymentResult> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('amount musbat bo`lishi kerak');
    }

    // Super admin kontekstida bypassTenant -> hamma klinika invoice'i ko'rinadi.
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Bekor qilingan hisob-fakturaga to`lov yo`q');
    }
    // PAID invoice'ga qayta to'liq to'lov yo'q (spec talabi).
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Hisob-faktura allaqachon to`langan');
    }
    // Qoldiqdan oshirib bo'lmaydi (qisman to'lovga ruxsat, ortiqcha yo'q).
    if (amount.greaterThan(invoice.debtAmount)) {
      throw new BadRequestException(
        `To'lov summasi qoldiqdan (${invoice.debtAmount.toString()}) oshmasligi kerak`,
      );
    }

    const performedAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const result = await this.payments.confirmPayment({
      clinicId: invoice.clinicId,
      invoiceId: invoice.id,
      amount,
      provider: PaymentProvider.MANUAL,
      method: dto.method,
      reference: dto.reference,
      confirmedBy: adminId,
      performedAt,
      raw: {
        manual: true,
        method: dto.method,
        reference: dto.reference ?? null,
        reportedPaidAt: performedAt.toISOString(),
        confirmedBy: adminId,
      },
    });

    // AUDIT MAJBURIY (spec 5.4): kim, qancha, qaysi usul, natija.
    await this.auditService.log({
      action: 'MANUAL_PAYMENT',
      entity: 'Invoice',
      entityId: invoice.id,
      actorType: ActorType.SUPER_ADMIN,
      userId: adminId,
      clinicId: invoice.clinicId,
      metadata: {
        amount: amount.toString(),
        method: dto.method,
        reference: dto.reference ?? null,
        paidAt: performedAt.toISOString(),
        transactionId: result.transactionId,
        invoiceStatus: result.invoiceStatus,
        fullyPaid: result.fullyPaid,
      },
    });

    return result;
  }
}

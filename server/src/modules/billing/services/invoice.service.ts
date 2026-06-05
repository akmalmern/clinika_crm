import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { buildPaginationMeta } from '../../../common/dto/pagination-query.dto';
import { Paginated } from '../../../common/interfaces/api-response.interface';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';

type InvoiceRow = Prisma.InvoiceGetPayload<object>;

export interface InvoiceResponse {
  id: string;
  clinicId: string;
  subscriptionId: string | null;
  invoiceNumber: string;
  totalAmount: string;
  paidAmount: string;
  debtAmount: string;
  currency: string;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
}

export interface InvoiceFindOptions {
  /** Super admin barcha klinikalarni ko'ra oladi; bu yerda ixtiyoriy filtr. */
  clinicId?: string;
}

/**
 * Hisob-fakturalarni o'qish (super admin va klinika). Tenant izolyatsiyasi:
 * klinika foydalanuvchisi uchun Prisma extension avtomatik `clinic_id` filtrini
 * qo'yadi (Invoice TENANT_MODELS'da). Super admin (bypassTenant) hammasini ko'radi.
 */
@Injectable()
export class InvoiceService {
  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  async findAll(
    query: ListInvoicesQueryDto,
    opts: InvoiceFindOptions = {},
  ): Promise<Paginated<InvoiceResponse>> {
    const where: Prisma.InvoiceWhereInput = { deletedAt: null };
    if (opts.clinicId) where.clinicId = opts.clinicId;
    if (query.status) where.status = query.status;
    if (query.search)
      where.invoiceNumber = { contains: query.search, mode: 'insensitive' };
    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to);
      where.createdAt = createdAt;
    }

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: rows.map(toInvoiceResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(
    id: string,
    opts: InvoiceFindOptions = {},
  ): Promise<InvoiceResponse> {
    return toInvoiceResponse(await this.getOrThrow(id, opts));
  }

  /** PDF/audit uchun xom yozuv (klinika nomi bilan). */
  async getDetailed(id: string, opts: InvoiceFindOptions = {}) {
    const where: Prisma.InvoiceWhereInput = { id, deletedAt: null };
    if (opts.clinicId) where.clinicId = opts.clinicId;
    const invoice = await this.prisma.invoice.findFirst({
      where,
      include: { clinic: true, subscription: { include: { plan: true } } },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }

  private async getOrThrow(
    id: string,
    opts: InvoiceFindOptions,
  ): Promise<InvoiceRow> {
    const where: Prisma.InvoiceWhereInput = { id, deletedAt: null };
    if (opts.clinicId) where.clinicId = opts.clinicId;
    const invoice = await this.prisma.invoice.findFirst({ where });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }
}

export function toInvoiceResponse(inv: InvoiceRow): InvoiceResponse {
  return {
    id: inv.id,
    clinicId: inv.clinicId,
    subscriptionId: inv.subscriptionId,
    invoiceNumber: inv.invoiceNumber,
    totalAmount: inv.totalAmount.toString(),
    paidAmount: inv.paidAmount.toString(),
    debtAmount: inv.debtAmount.toString(),
    currency: inv.currency,
    status: inv.status,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
  };
}

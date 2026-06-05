import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '../../../common/constants/roles.constant';
import { Permission } from '../../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { InvoiceService } from '../services/invoice.service';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { ManualPaymentService } from '../services/manual-payment.service';
import { PaymentStatsService } from '../services/payment-stats.service';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';
import { ManualPaymentDto } from '../dto/manual-payment.dto';
import { PaymentStatsQueryDto } from '../dto/stats-query.dto';

/**
 * Super Admin billing boshqaruvi (spec 5.4/5.5): invoice'lar, qo'lda to'lov,
 * PDF eksport, to'lov usuli statistikasi. Faqat SUPER_ADMIN + BILLING_MANAGE.
 */
@ApiTags('billing (super-admin)')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Permissions(Permission.BILLING_MANAGE)
@Controller('super-admin')
export class BillingAdminController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly manualPayment: ManualPaymentService,
    private readonly stats: PaymentStatsService,
  ) {}

  @Get('invoices')
  @ApiOperation({ summary: "Barcha hisob-fakturalar (filter: status/klinika/sana)" })
  listInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.invoiceService.findAll(query, { clinicId: query.clinicId });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Bitta hisob-faktura' })
  getInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceService.findOne(id);
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Hisob-fakturani PDF sifatida yuklab olish' })
  async invoicePdfExport(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const invoice = await this.invoiceService.getDetailed(id);
    const pdf = this.invoicePdf.build(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.invoicePdf.buildFileName(invoice.invoiceNumber)}"`,
    );
    res.send(pdf);
  }

  @Post('payments/manual')
  @ApiOperation({
    summary: "Qo'lda to'lov (naqd/bank) — invoice PAID/PARTIAL, audit majburiy",
  })
  manual(@Body() dto: ManualPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manualPayment.record(dto, user.userId);
  }

  @Get('payments/stats')
  @ApiOperation({ summary: "To'lov usuli statistikasi (provider/method)" })
  paymentStats(@Query() query: PaymentStatsQueryDto) {
    return this.stats.byMethod(query);
  }
}

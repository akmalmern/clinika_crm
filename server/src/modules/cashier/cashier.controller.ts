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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CashierService } from './cashier.service';
import { PatientReceiptPdfService } from './patient-receipt-pdf.service';
import { CreatePatientInvoiceDto } from './dto/create-patient-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPatientInvoicesQueryDto } from './dto/list-patient-invoices-query.dto';

/**
 * Kassa (bemor to'lovi). Tenant izolyatsiya (clinicId TOKEN'dan).
 * O'qish PATIENT_INVOICE_READ, to'lov/yaratish PATIENT_PAYMENT (kassir).
 */
@ApiTags('cashier (patient billing)')
@ApiBearerAuth()
@Controller('clinic')
export class CashierController {
  constructor(
    private readonly cashier: CashierService,
    private readonly receiptPdf: PatientReceiptPdfService,
  ) {}

  @Post('patient-invoices')
  @Permissions(Permission.PATIENT_PAYMENT)
  @ApiOperation({ summary: 'Bemor hisob-fakturasini yaratish' })
  createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientInvoiceDto,
  ) {
    return this.cashier.createInvoice(user.clinicId!, dto, user.userId);
  }

  @Get('patient-invoices')
  @Permissions(Permission.PATIENT_INVOICE_READ)
  @ApiOperation({ summary: "Bemor hisob-fakturalari ro'yxati" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPatientInvoicesQueryDto,
  ) {
    return this.cashier.findAllInvoices(user.clinicId!, query);
  }

  @Get('patient-invoices/:id')
  @Permissions(Permission.PATIENT_INVOICE_READ)
  @ApiOperation({ summary: 'Bitta hisob-faktura (to`lovlari bilan)' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cashier.findInvoice(user.clinicId!, id);
  }

  @Post('patient-invoices/:id/payments')
  @Permissions(Permission.PATIENT_PAYMENT)
  @ApiOperation({
    summary: "To'lov qabul qilish (qisman/to'liq, ortiqcha rad etiladi)",
  })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.cashier.pay(user.clinicId!, id, dto, user.userId);
  }

  @Get('payments/:id/receipt')
  @Permissions(Permission.PATIENT_INVOICE_READ)
  @ApiOperation({ summary: "To'lov cheki (PDF)" })
  async receipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { payment, clinic } = await this.cashier.getReceiptData(
      user.clinicId!,
      id,
    );
    const pdf = this.receiptPdf.build(payment, clinic);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.receiptPdf.buildFileName(id)}"`,
    );
    res.send(pdf);
  }
}

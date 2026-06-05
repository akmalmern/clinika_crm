import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AllowSuspended } from '../../../common/decorators/allow-suspended.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ActorType } from '../../../common/constants/roles.constant';
import { Permission } from '../../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { InvoiceService } from '../services/invoice.service';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';

/**
 * Klinika o'z hisob-fakturalarini ko'radi. @AllowSuspended — SUSPENDED klinika ham
 * nimani to'lashini ko'ra olishi kerak. Tenant izolyatsiyasi avtomatik (Prisma
 * extension `clinic_id` qo'yadi). BILLING_READ ruxsati (CLINIC_ADMIN'da bor).
 */
@ApiTags('billing (clinic)')
@ApiBearerAuth()
@AllowSuspended()
@Permissions(Permission.BILLING_READ)
@Controller('billing/invoices')
export class ClinicInvoicesController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: "O'z klinikasi hisob-fakturalari" })
  list(
    @Query() query: ListInvoicesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const clinicId = this.requireClinic(user);
    return this.invoiceService.findAll(query, { clinicId });
  }

  @Get(':id')
  @ApiOperation({ summary: "O'z klinikasi bitta hisob-faktura" })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const clinicId = this.requireClinic(user);
    return this.invoiceService.findOne(id, { clinicId });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Hisob-faktura PDF (o`z klinikasi)' })
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const clinicId = this.requireClinic(user);
    const invoice = await this.invoiceService.getDetailed(id, { clinicId });
    const pdf = this.invoicePdf.build(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.invoicePdf.buildFileName(invoice.invoiceNumber)}"`,
    );
    res.send(pdf);
  }

  private requireClinic(user: AuthenticatedUser): string {
    if (user.actorType !== ActorType.USER || !user.clinicId) {
      throw new ForbiddenException(
        'Bu endpoint faqat klinika foydalanuvchilari uchun',
      );
    }
    return user.clinicId;
  }
}

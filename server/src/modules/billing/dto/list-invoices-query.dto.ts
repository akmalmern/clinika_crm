import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { InvoiceStatus } from '../constants/billing.constant';

const STATUSES = Object.values(InvoiceStatus);

/**
 * Hisob-fakturalar ro'yxati filtri (pagination + status + sana oralig'i).
 * `search` -> invoice_number bo'yicha.
 */
export class ListInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES, description: 'Invoice holati' })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Boshlanish (ISO sana) — created_at >=' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash (ISO sana) — created_at <=' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: 'Klinika bo`yicha filtr (faqat super admin uchun)',
  })
  @IsOptional()
  @IsUUID()
  clinicId?: string;
}

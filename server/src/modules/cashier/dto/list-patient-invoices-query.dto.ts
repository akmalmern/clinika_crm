import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ALL_PATIENT_INVOICE_STATUSES } from '../constants/cashier.constant';

export class ListPatientInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Bemor bo`yicha filtr' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: ALL_PATIENT_INVOICE_STATUSES })
  @IsOptional()
  @IsIn(ALL_PATIENT_INVOICE_STATUSES)
  status?: string;
}

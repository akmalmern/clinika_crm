import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Ko'rik yozuvlari ro'yxati — bemor bo'yicha filtr + pagination. */
export class ListMedicalRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Bemor bo`yicha filtr' })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

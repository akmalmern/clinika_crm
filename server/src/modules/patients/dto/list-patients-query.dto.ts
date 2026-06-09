import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ALL_GENDERS } from '../constants/patient.constant';

/** Bemorlar ro'yxati: `search` (ism/telefon) PaginationQueryDto'dan + gender filtri. */
export class ListPatientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ALL_GENDERS,
    description: 'Jins bo`yicha filtr',
  })
  @IsOptional()
  @IsIn(ALL_GENDERS)
  gender?: string;
}

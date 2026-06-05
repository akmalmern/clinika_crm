import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ALL_CLINIC_STATUSES } from '../../../common/constants/subscription.constant';

export class ListClinicsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ALL_CLINIC_STATUSES,
    description: "Holat bo'yicha filter",
  })
  @IsOptional()
  @IsIn(ALL_CLINIC_STATUSES)
  status?: string;
}

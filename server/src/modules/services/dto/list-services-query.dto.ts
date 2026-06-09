import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Xizmatlar ro'yxati: `search` (nom) + kategoriya/faollik filtri. */
export class ListServicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Kategoriya bo`yicha filtr' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Faqat faol/nofaol' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

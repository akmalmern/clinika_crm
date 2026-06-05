import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CLINIC_ROLES } from '../../../common/constants/roles.constant';

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: CLINIC_ROLES,
    description: "Rol bo'yicha filter",
  })
  @IsOptional()
  @IsIn(CLINIC_ROLES)
  role?: string;
}

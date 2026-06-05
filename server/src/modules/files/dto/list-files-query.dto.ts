import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  ALL_FILE_CATEGORIES,
  ALL_OWNER_TYPES,
} from '../constants/file.constant';

/** Owner bo'yicha fayllar ro'yxati (owner_type + owner_id + ixtiyoriy category). */
export class ListFilesQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: ALL_OWNER_TYPES })
  @IsIn(ALL_OWNER_TYPES)
  ownerType!: string;

  @ApiProperty({ description: 'Egasi ID (UUID)' })
  @IsUUID()
  ownerId!: string;

  @ApiPropertyOptional({ enum: ALL_FILE_CATEGORIES })
  @IsOptional()
  @IsIn(ALL_FILE_CATEGORIES)
  category?: string;
}

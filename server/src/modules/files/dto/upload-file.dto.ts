import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import {
  ALL_FILE_CATEGORIES,
  ALL_OWNER_TYPES,
} from '../constants/file.constant';

/**
 * Fayl yuklash metadata'si (multipart/form-data ning matn maydonlari).
 * Faylning o'zi @UploadedFile orqali keladi.
 */
export class UploadFileDto {
  @ApiProperty({ enum: ALL_OWNER_TYPES, description: 'Egasi turi' })
  @IsIn(ALL_OWNER_TYPES)
  ownerType!: string;

  @ApiProperty({ description: 'Egasi ID (UUID)' })
  @IsUUID()
  ownerId!: string;

  @ApiProperty({ enum: ALL_FILE_CATEGORIES, description: 'Fayl toifasi' })
  @IsIn(ALL_FILE_CATEGORIES)
  category!: string;
}

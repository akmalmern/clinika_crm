import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ALL_FILE_CATEGORIES } from '../constants/file.constant';

/**
 * Staff/Patient hujjat biriktirish — multipart matn maydoni (category).
 * Faylning o'zi @UploadedFile orqali; owner controller path'idan aniqlanadi.
 */
export class AttachDocumentDto {
  @ApiProperty({ enum: ALL_FILE_CATEGORIES, description: 'Hujjat toifasi' })
  @IsIn(ALL_FILE_CATEGORIES)
  category!: string;
}

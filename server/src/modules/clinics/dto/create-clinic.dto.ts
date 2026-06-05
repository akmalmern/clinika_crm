import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Klinikaning o'z maydonlari (create/update uchun umumiy). */
export class ClinicCoreDto {
  @ApiProperty({ example: 'Demo Klinika' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'demo-klinika',
    description: 'Berilmasa nomdan yasaladi',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug faqat kichik harf, raqam va tire' })
  @Transform(lower)
  slug?: string;

  @ApiPropertyOptional({ example: 'Toshkent sh., Chilonzor 5' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@demo-klinika.uz' })
  @IsOptional()
  @IsEmail()
  @Transform(lower)
  email?: string;
}

export class CreateClinicDto extends ClinicCoreDto {
  // --- Boshlang'ich CLINIC_ADMIN ---
  @ApiProperty({ example: 'Aliyev Vali' })
  @IsString()
  @IsNotEmpty()
  adminFullName!: string;

  @ApiProperty({ example: 'admin@demo-klinika.uz' })
  @IsEmail()
  @Transform(lower)
  adminEmail!: string;

  @ApiPropertyOptional({ example: '+998901112233' })
  @IsOptional()
  @IsString()
  adminPhone?: string;

  @ApiPropertyOptional({
    description: 'Berilmasa — xavfsiz parol generatsiya qilinib qaytariladi',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  // --- Obuna ---
  @ApiPropertyOptional({
    description: 'Tarif ID (berilmasa standart tarif olinadi)',
  })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'TRIAL bilan boshlash (false -> ACTIVE)',
  })
  @IsOptional()
  @IsBoolean()
  trial?: boolean;
}

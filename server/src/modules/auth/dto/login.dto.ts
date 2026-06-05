import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'admin@clinic-crm.uz' })
  @IsEmail({}, { message: "Email noto'g'ri formatda" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'Admin12345!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lsin" })
  password!: string;

  /**
   * Klinika foydalanuvchisi (CLINIC_ADMIN/DOCTOR/...) login qilganda klinika
   * slug'i beriladi. Berilmasa — Super Admin login deb qaraladi.
   * (Bir email bir nechta klinikada bo'lishi mumkin, shuning uchun klinika kerak.)
   */
  @ApiPropertyOptional({
    example: 'demo-klinika',
    description: 'Klinika slug (clinic login uchun)',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  clinicSlug?: string;
}

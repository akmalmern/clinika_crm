import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CLINIC_ROLES } from '../../../common/constants/roles.constant';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateMemberDto {
  @ApiProperty({ example: 'Karimov Doniyor' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'doctor@demo-klinika.uz' })
  @IsEmail()
  @Transform(lower)
  email!: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: CLINIC_ROLES, example: 'DOCTOR' })
  @IsIn(CLINIC_ROLES, { message: "role klinika roli bo'lishi kerak" })
  role!: string;

  @ApiPropertyOptional({ example: 'Kardiolog' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ example: 'Kardiologiya' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({
    description: 'Berilmasa — xavfsiz parol generatsiya qilinib qaytariladi',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Mavjud foydalanuvchini shu klinikaga biriktirish (bir nechta klinikada ishlash uchun)',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

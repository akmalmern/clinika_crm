import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ALL_GENDERS, BLOOD_TYPES } from '../constants/patient.constant';

export class CreatePatientDto {
  @ApiProperty({ example: 'Aliyeva Nodira' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({
    example: '1990-05-20',
    description: 'Tug`ilgan sana (ISO)',
  })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({ enum: ALL_GENDERS })
  @IsOptional()
  @IsIn(ALL_GENDERS)
  gender?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Toshkent sh., Yunusobod' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: BLOOD_TYPES })
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: string;

  @ApiPropertyOptional({ example: 'Penisillinga allergiya' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergies?: string;

  @ApiPropertyOptional({ example: 'Qo`shimcha eslatma' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

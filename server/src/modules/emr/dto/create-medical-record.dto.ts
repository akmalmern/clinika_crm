import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Tibbiy ko'rik yozuvi (spec 7.7). doctorId berilmasa va foydalanuvchi shifokor
 * bo'lsa — o'zi qo'yiladi. Matnli maydonlar ixtiyoriy (qoralama bo'lishi mumkin).
 */
export class CreateMedicalRecordDto {
  @ApiProperty({ description: 'Bemor ID' })
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Bog`langan qabul ID' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({
    description: 'Shifokor ID (berilmasa — joriy shifokor)',
  })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Shikoyatlar' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  complaints?: string;

  @ApiPropertyOptional({ description: 'Tashxis' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'J06.9', description: 'ICD-10 kod' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  icdCode?: string;

  @ApiPropertyOptional({ description: 'Davolash' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatment?: string;

  @ApiPropertyOptional({ description: 'Qo`shimcha eslatma' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

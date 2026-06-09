import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Bemor hisob-fakturasini qo'lda yaratish (xizmat ko'rsatilganda). */
export class CreatePatientInvoiceDto {
  @ApiProperty({ description: 'Bemor ID' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ example: '150000.00', description: "Jami summa (so'm)" })
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount musbat son bo`lsin' })
  amount!: string;

  @ApiPropertyOptional({ description: 'Bog`langan qabul ID' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

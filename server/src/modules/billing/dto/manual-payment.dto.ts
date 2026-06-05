import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MANUAL_METHODS } from '../constants/billing.constant';

/**
 * SUPER_ADMIN qo'lda (naqd/bank) to'lovni qayd etadi (spec 5.4 — MANUAL).
 * Pul string sifatida qabul qilinadi (Float EMAS) -> Decimal'ga aylantiriladi.
 */
export class ManualPaymentDto {
  @ApiProperty({ description: "Hisob-faktura ID (to'lov tegishli)" })
  @IsString()
  @Matches(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    { message: 'invoiceId UUID bo`lishi kerak' },
  )
  invoiceId!: string;

  @ApiProperty({ example: '199000.00', description: "To'lov summasi (so'm)" })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount musbat son bo`lsin (masalan 199000 yoki 199000.00)',
  })
  amount!: string;

  @ApiProperty({ enum: MANUAL_METHODS, description: "To'lov usuli" })
  @IsIn(MANUAL_METHODS)
  method!: string;

  @ApiPropertyOptional({ description: "To'lov hujjati raqami / izoh" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;

  @ApiPropertyOptional({
    description: "Haqiqiy to'lov sanasi (ISO). Berilmasa — hozir.",
  })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}

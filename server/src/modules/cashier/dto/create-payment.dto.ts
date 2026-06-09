import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ALL_PATIENT_PAYMENT_METHODS } from '../constants/cashier.constant';

/** Bemor to'lovi (bo'lib-bo'lib to'lash mumkin). */
export class CreatePaymentDto {
  @ApiProperty({ example: '50000.00', description: "To'lov summasi (so'm)" })
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount musbat son bo`lsin' })
  amount!: string;

  @ApiProperty({ enum: ALL_PATIENT_PAYMENT_METHODS })
  @IsIn(ALL_PATIENT_PAYMENT_METHODS)
  method!: string;

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

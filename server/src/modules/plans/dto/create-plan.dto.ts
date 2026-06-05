import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ALL_BILLING_CYCLES } from '../../../common/constants/subscription.constant';

export class CreatePlanDto {
  @ApiProperty({ example: 'BASIC' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: '199000.00',
    description: 'Pul Decimal (string) — Float EMAS',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "price musbat son bo'lsin (masalan: 199000 yoki 199000.00)",
  })
  price!: string;

  @ApiPropertyOptional({ example: 'UZS', default: 'UZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: ALL_BILLING_CYCLES, example: 'MONTHLY' })
  @IsIn(ALL_BILLING_CYCLES, {
    message: "billingCycle MONTHLY yoki YEARLY bo'lsin",
  })
  billingCycle!: string;

  @ApiPropertyOptional({
    type: Object,
    example: { maxStaff: 10, maxPatients: 1000, storageGb: 5, smsCount: 500 },
  })
  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { pharmacy: false, telegram: true },
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

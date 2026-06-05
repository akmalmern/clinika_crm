import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { PaymentProvider } from '../constants/billing.constant';

const PROVIDERS = Object.values(PaymentProvider);

/** To'lov statistikasi filtri (sana oralig'i + provayder). */
export class PaymentStatsQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish (ISO) — performed_at >=' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash (ISO) — performed_at <=' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: string;
}

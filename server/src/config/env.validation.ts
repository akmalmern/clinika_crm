import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Muhit o'zgaruvchilarini ilova ko'tarilishidan OLDIN tekshiradi.
 * Noto'g'ri/yetishmayotgan sozlama bo'lsa — server umuman ishga tushmaydi
 * (fail-fast), kutilmagan runtime xatolardan ko'ra yaxshiroq.
 */
export class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsNumber()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // --- Redis ---
  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // --- JWT ---
  @IsString()
  @MinLength(16, {
    message: "JWT_ACCESS_SECRET kamida 16 belgidan iborat bo'lsin",
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES = '15m';

  @IsString()
  @MinLength(16, {
    message: "JWT_REFRESH_SECRET kamida 16 belgidan iborat bo'lsin",
  })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES = '7d';

  // --- Throttler ---
  @Type(() => Number)
  @IsNumber()
  THROTTLE_TTL = 60000;

  @Type(() => Number)
  @IsNumber()
  THROTTLE_LIMIT = 120;

  // --- Boshqalar ---
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  DEFAULT_LOCALE = 'uz';

  // --- MinIO (Phase 4'da to'liq ishlatiladi; bu yerda faqat validatsiya) ---
  @IsString()
  @IsOptional()
  MINIO_ENDPOINT?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  MINIO_PORT?: number;

  @IsString()
  @IsOptional()
  MINIO_BUCKET?: string;

  // 'true' | 'false' (string) — config.ts process.env'dan to'g'ridan-to'g'ri o'qiydi.
  @IsString()
  @IsOptional()
  MINIO_USE_SSL?: string;

  // --- Storage (fayl moduli, Phase 4) ---
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  STORAGE_SIGNED_URL_TTL?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  STORAGE_MAX_FILE_MB?: number;

  // --- Scheduling (qabul, Phase 5B) ---
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  CLINIC_TZ_OFFSET_MINUTES?: number;

  // --- Reports (Phase 7B) — og'ir agregat kesh muddati (sekund). ---
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  REPORTS_CACHE_TTL_SEC?: number;

  // --- Notification / SMS (Phase 7A). Kalitlar faqat .env'da. ---
  @IsString()
  @IsOptional()
  SMS_PROVIDER?: string; // log | eskiz

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  NOTIFY_REMINDER_LEAD_MIN?: number;

  @IsString()
  @IsOptional()
  ESKIZ_EMAIL?: string;

  @IsString()
  @IsOptional()
  ESKIZ_PASSWORD?: string;

  @IsString()
  @IsOptional()
  ESKIZ_FROM?: string;

  @IsString()
  @IsOptional()
  ESKIZ_BASE_URL?: string;

  // --- Telegram bot (Phase 7A). Token/secret faqat .env'da. ---
  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_BOT_USERNAME?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_DOMAIN?: string;

  @IsString()
  @IsOptional()
  APP_PUBLIC_URL?: string;

  // --- Billing (obuna) ---
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  TRIAL_DAYS?: number;

  @IsString()
  @IsOptional()
  DEFAULT_CURRENCY?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  GRACE_DAYS?: number;

  // --- Payme (Merchant API). Sirlar faqat .env'da, kodga yozilmaydi. ---
  @IsString()
  @IsOptional()
  PAYME_MERCHANT_ID?: string;

  @IsString()
  @IsOptional()
  PAYME_MERCHANT_KEY?: string;

  @IsString()
  @IsOptional()
  PAYME_TEST_KEY?: string;

  @IsString()
  @IsOptional()
  PAYME_ACCOUNT_FIELD?: string;

  // --- Click (Merchant API) ---
  @IsString()
  @IsOptional()
  CLICK_SERVICE_ID?: string;

  @IsString()
  @IsOptional()
  CLICK_MERCHANT_ID?: string;

  @IsString()
  @IsOptional()
  CLICK_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  CLICK_MERCHANT_USER_ID?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true, // "3000" -> 3000
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(
      `Muhit o'zgaruvchilari validatsiyasi muvaffaqiyatsiz:\n  - ${details}`,
    );
  }

  return validated;
}

/**
 * Tipizatsiyalangan konfiguratsiya. ConfigService orqali `config.get('jwt.accessSecret')`
 * ko'rinishida olinadi. Barcha env o'qish shu yerda markazlashtiriladi —
 * boshqa joyda `process.env` ishlatilmaydi.
 */
export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  defaultLocale: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpires: string;
  refreshSecret: string;
  refreshExpires: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface MinioConfig {
  endpoint: string;
  port: number;
  useSsl: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface StorageConfig {
  /** Signed (vaqtinchalik) URL amal qilish muddati (sekund). */
  signedUrlTtl: number;
  /** Bitta fayl maksimal hajmi (bayt). */
  maxFileSize: number;
}

export interface SchedulingConfig {
  /**
   * Klinika mahalliy vaqt offseti (daqiqa). Asia/Tashkent = UTC+5 = 300 (DST yo'q).
   * doctor_schedules "HH:MM" mahalliy vaqti shu offset bilan UTC'ga aylantiriladi.
   */
  tzOffsetMinutes: number;
}

export interface ReportsConfig {
  /**
   * Hisobot natijasini Redis'da keshlash muddati (sekund, cache-aside, spec 1.7.G).
   * Og'ir agregatsiya asosiy bazani sekinlashtirmasin. 0 -> kesh o'chiq.
   */
  cacheTtlSeconds: number;
  /**
   * Hisobotlarda mahalliy kun/oy guruhlash uchun offset (daqiqa). Scheduling bilan
   * bir xil manba (CLINIC_TZ_OFFSET_MINUTES) — UTC instant -> mahalliy bucket.
   */
  tzOffsetMinutes: number;
}

export interface NotificationConfig {
  /** SMS provayderi: 'log' (dev), 'eskiz'. */
  smsProvider: string;
  /** Qabuldan necha daqiqa oldin eslatma (BullMQ delayed job). */
  reminderLeadMinutes: number;
  eskiz: {
    baseUrl: string;
    email: string;
    password: string;
    from: string;
  };
}

export interface TelegramConfig {
  /** Bot token (faqat .env). Bo'sh bo'lsa bot ishga tushmaydi (dev). */
  botToken: string;
  /** t.me/<username>?start=<token> havolasi uchun. */
  botUsername: string;
  /** Webhook secret (X-Telegram-Bot-Api-Secret-Token). */
  webhookSecret: string;
  /** Domen berilsa — webhook; bo'lmasa — polling (dev). */
  webhookDomain: string;
  /** "Ilovaga kiring" havolalari uchun ilovaning ommaviy URL'i. */
  appBaseUrl: string;
}

export interface BillingConfig {
  trialDays: number;
  defaultCurrency: string;
  /** To'lov muddati o'tgach beriladigan qo'shimcha muhlat (kun). */
  graceDays: number;
}

export interface PaymeConfig {
  /** Payme kabinetidagi merchant (kassa) ID. */
  merchantId: string;
  /** Webhook Basic auth paroli (X-Auth). Faqat .env'da! */
  merchantKey: string;
  /** Test (sandbox) kaliti — ixtiyoriy, agar ishlatilsa qabul qilinadi. */
  testKey?: string;
  /** `account` ob'ektida invoice'ni aniqlovchi maydon nomi (kabinetda sozlanadi). */
  accountField: string;
}

export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  /** Imzo (sign_string MD5) uchun maxfiy kalit. Faqat .env'da! */
  secretKey: string;
  merchantUserId: string;
}

export interface CryptoConfig {
  /** Joriy (primary) shifrlash kaliti — base64(32 bayt). Bo'sh bo'lsa shifrlash o'chiq. */
  fieldKey?: string;
  /** Joriy kalit identifikatori (token ichida saqlanadi). Default 'k1'. */
  fieldKeyId: string;
  /** Rotatsiya: eski kalitlar deshifrlash uchun — "id1:base64,id2:base64". */
  fieldKeysOld?: string;
}

export interface ObservabilityConfig {
  /** pino log darajasi: trace|debug|info|warn|error. Prod default 'info'. */
  logLevel: string;
  /** Sentry DSN (bo'sh bo'lsa Sentry o'chiq). Faqat .env'da. */
  sentryDsn?: string;
  /** Sentry environment yorlig'i (production/staging/...). */
  sentryEnv: string;
  /** Tracing namuna olish darajasi (0..1). Default 0 (o'chiq). */
  sentryTracesSampleRate: number;
  /** Prometheus /metrics yoqilganmi (default ha). */
  metricsEnabled: boolean;
}

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'uz',
  } satisfies AppConfig,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  } satisfies JwtConfig,

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  } satisfies RedisConfig,

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  } satisfies ThrottleConfig,

  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
    bucket: process.env.MINIO_BUCKET ?? 'clinic-files',
  } satisfies MinioConfig,

  storage: {
    signedUrlTtl: parseInt(process.env.STORAGE_SIGNED_URL_TTL ?? '300', 10),
    maxFileSize:
      parseInt(process.env.STORAGE_MAX_FILE_MB ?? '15', 10) * 1024 * 1024,
  } satisfies StorageConfig,

  scheduling: {
    tzOffsetMinutes: parseInt(
      process.env.CLINIC_TZ_OFFSET_MINUTES ?? '300',
      10,
    ),
  } satisfies SchedulingConfig,

  reports: {
    cacheTtlSeconds: parseInt(process.env.REPORTS_CACHE_TTL_SEC ?? '60', 10),
    tzOffsetMinutes: parseInt(
      process.env.CLINIC_TZ_OFFSET_MINUTES ?? '300',
      10,
    ),
  } satisfies ReportsConfig,

  notification: {
    smsProvider: process.env.SMS_PROVIDER ?? 'log',
    reminderLeadMinutes: parseInt(
      process.env.NOTIFY_REMINDER_LEAD_MIN ?? '60',
      10,
    ),
    eskiz: {
      baseUrl: process.env.ESKIZ_BASE_URL ?? 'https://notify.eskiz.uz/api',
      email: process.env.ESKIZ_EMAIL ?? '',
      password: process.env.ESKIZ_PASSWORD ?? '',
      from: process.env.ESKIZ_FROM ?? '4546',
    },
  } satisfies NotificationConfig,

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    webhookDomain: process.env.TELEGRAM_WEBHOOK_DOMAIN ?? '',
    appBaseUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3001',
  } satisfies TelegramConfig,

  billing: {
    trialDays: parseInt(process.env.TRIAL_DAYS ?? '14', 10),
    defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'UZS',
    graceDays: parseInt(process.env.GRACE_DAYS ?? '3', 10),
  } satisfies BillingConfig,

  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID ?? '',
    merchantKey: process.env.PAYME_MERCHANT_KEY ?? '',
    testKey: process.env.PAYME_TEST_KEY || undefined,
    accountField: process.env.PAYME_ACCOUNT_FIELD ?? 'invoice_id',
  } satisfies PaymeConfig,

  click: {
    serviceId: process.env.CLICK_SERVICE_ID ?? '',
    merchantId: process.env.CLICK_MERCHANT_ID ?? '',
    secretKey: process.env.CLICK_SECRET_KEY ?? '',
    merchantUserId: process.env.CLICK_MERCHANT_USER_ID ?? '',
  } satisfies ClickConfig,

  crypto: {
    fieldKey: process.env.FIELD_ENCRYPTION_KEY || undefined,
    fieldKeyId: process.env.FIELD_ENCRYPTION_KEY_ID ?? 'k1',
    fieldKeysOld: process.env.FIELD_ENCRYPTION_KEYS_OLD || undefined,
  } satisfies CryptoConfig,

  observability: {
    logLevel:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    sentryDsn: process.env.SENTRY_DSN || undefined,
    sentryEnv: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? 'development',
    sentryTracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0',
    ),
    metricsEnabled: (process.env.METRICS_ENABLED ?? 'true') !== 'false',
  } satisfies ObservabilityConfig,
});

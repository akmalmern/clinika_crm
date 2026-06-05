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
});

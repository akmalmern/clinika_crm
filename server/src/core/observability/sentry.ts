import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Sentry'ni ishga tushiradi — FAQAT SENTRY_DSN berilgan bo'lsa. DSN bo'lmasa
 * jim o'tkazib yuboriladi (dev/test'da Sentry talab qilinmaydi). Init ilova
 * yaratilishidan OLDIN, eng erta chaqirilishi kerak (main.ts).
 */
export function initSentry(options: {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  release?: string;
}): boolean {
  if (!options.dsn) return false;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    tracesSampleRate: options.tracesSampleRate,
    release: options.release,
  });
  enabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Xatoni Sentry'ga yuboradi (yoqilmagan bo'lsa no-op). */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

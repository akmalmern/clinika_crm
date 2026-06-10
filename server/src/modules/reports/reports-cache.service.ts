import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsConfig } from '../../config/configuration';
import { RedisService } from '../../core/redis/redis.service';
import { REPORT_CACHE_PREFIX } from './constants/report.constant';

/**
 * Hisobot kesh-aside (spec 1.7.G): og'ir agregat natija Redis'da TTL bilan
 * saqlanadi — asosiy bazani sekinlashtirmaydi. Redis ishlamasa (xato) — jim
 * fallback: natija hisoblanadi, ammo so'rov BUZILMAYDI (tibbiy ma'lumotni
 * ko'rsatish to'xtamasin). TTL=0 bo'lsa kesh butunlay o'chiq.
 */
@Injectable()
export class ReportsCacheService {
  private readonly logger = new Logger('ReportsCache');
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttl = config.getOrThrow<ReportsConfig>('reports').cacheTtlSeconds;
  }

  /**
   * Kesh kalitini barqaror (deterministik) quradi: prefix:scope:report:params.
   * params obyekti tartiblangan kalitlar bilan -> bir xil so'rov bir xil kalit.
   */
  buildKey(
    scope: string,
    report: string,
    params: Record<string, unknown>,
  ): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${stringifyParam(params[k])}`)
      .join('&');
    return `${REPORT_CACHE_PREFIX}:${scope}:${report}:${sorted}`;
  }

  /**
   * Keshda bo'lsa qaytaradi, bo'lmasa compute() ishga tushib natija keshlanadi.
   * Redis xatosi natijani buzmaydi (graceful degradation).
   */
  async getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    if (this.ttl <= 0) return compute();

    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (err) {
      this.logger.warn(
        `Kesh o'qishda xato (e'tiborsiz): ${(err as Error)?.message}`,
      );
    }

    const fresh = await compute();

    try {
      await this.redis.set(key, JSON.stringify(fresh), this.ttl);
    } catch (err) {
      this.logger.warn(
        `Kesh yozishda xato (e'tiborsiz): ${(err as Error)?.message}`,
      );
    }
    return fresh;
  }
}

function stringifyParam(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  ) {
    return String(v);
  }
  // Boshqa (obyekt) tur — kesh kalitida kutilmaydi, ammo xavfsiz seriyalash.
  return JSON.stringify(v);
}

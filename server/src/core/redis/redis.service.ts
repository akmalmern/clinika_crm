import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/configuration';

/**
 * Redis xizmati — refresh token "whitelist", access token blacklist va
 * kelajakda cache/sessiya uchun. Backend stateless bo'lib qoladi (spec 1.6.C):
 * barcha holat shu yerda.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<RedisConfig>('redis');
    this.client = new Redis({
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) =>
      this.logger.error(`Redis xatosi: ${err.message}`),
    );
  }

  onModuleInit(): void {
    this.client.on('connect', () => this.logger.log('Redis ulanishi tayyor'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Xom client (kerak bo'lganda). */
  get raw(): Redis {
    return this.client;
  }

  /** Qiymat o'rnatish (ixtiyoriy TTL — sekundlarda). */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  /** Set'ga element qo'shish (TTL bilan — sessiya jtilarini guruhlash uchun). */
  async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    await this.client.sadd(key, member);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.expire(key, ttlSeconds);
    }
  }

  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }
}

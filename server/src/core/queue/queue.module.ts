import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '../../config/configuration';

/**
 * BullMQ ulanishini (Redis) BIR MARTA ro'yxatga oladi va global qiladi —
 * shunda har modul `BullModule.registerQueue(...)` orqali o'z navbatini qo'shadi
 * (billing, files-cleanup, kelajakda notifications). Stateless backend (spec 1.6.C):
 * navbat holati Redis'da.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

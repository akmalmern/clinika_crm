import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ObservabilityConfig } from '../../config/configuration';
import { getTenantStore } from '../tenant/tenant-context';

/**
 * Strukturalangan loglar (spec 10): pino. Prod'da JSON (log-yig'uvchilar uchun),
 * dev'da o'qiladigan pretty. Har log qatorida `requestId` (tenant store'dan —
 * xato javobi va auditdagi bilan BIR XIL) + clinicId bo'ladi. Nozik maydonlar
 * (token/parol/cookie) redaktsiya qilinadi.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const obs = config.getOrThrow<ObservabilityConfig>('observability');
        const isProd = process.env.NODE_ENV === 'production';
        return {
          pinoHttp: {
            level: obs.logLevel,
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname,req,res',
                  },
                },
            // request-id manbai: kelgan x-request-id yoki yangi UUID.
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const header = req.headers['x-request-id'];
              const id =
                (Array.isArray(header) ? header[0] : header) || randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            // Har log qatoriga tenant store'dagi kanonik requestId + clinicId.
            customProps: () => {
              const store = getTenantStore();
              if (!store) return {};
              return {
                requestId: store.requestId,
                clinicId: store.clinicId,
                userId: store.userId,
              };
            },
            // Shovqinli endpoint'lar avtomatik loglanmaydi.
            autoLogging: {
              ignore: (req: IncomingMessage) => {
                const url = req.url ?? '';
                return (
                  url.endsWith('/metrics') ||
                  url.endsWith('/health') ||
                  url.endsWith('/ready')
                );
              },
            },
            // MAXFIY ma'lumotlar loglanmaydi (spec 10).
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.adminPassword',
                'req.body.refreshToken',
              ],
              remove: true,
            },
            serializers: {
              req: (req: { method?: string; url?: string }) => ({
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode?: number }) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}

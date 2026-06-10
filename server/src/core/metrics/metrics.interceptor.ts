import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Har HTTP so'rov uchun davomiylik + statusni metrikaga yozadi. Route sifatida
 * Express route pattern'i (`/clinic/patients/:id`) ishlatiladi — yuqori
 * kardinallikning (har xil id) oldini oladi.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !this.metrics.enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationSec =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        // Express `req.route` tipi `any` — qo'lda toraytiramiz (path pattern).
        const routePath = (req as { route?: { path?: string } }).route?.path;
        const route = routePath ?? req.path ?? 'unknown';
        this.metrics.observe(req.method, route, res.statusCode, durationSec);
      }),
    );
  }
}

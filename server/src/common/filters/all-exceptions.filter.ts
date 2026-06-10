import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getTenantStore } from '../../core/tenant/tenant-context';
import { captureException } from '../../core/observability/sentry';

interface ErrorBody {
  success: false;
  data: null;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  statusCode: number;
  path: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Global xato filtri — barcha exception'larni standart formatga keltiradi.
 * Validatsiya xatolari (BadRequestException massivi) tushunarli birlashtiriladi.
 * Kutilmagan xatolar 500 sifatida loglanadi, lekin ichki tafsilot tashqariga chiqmaydi.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ichki server xatosi';
    let code = 'INTERNAL_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      code = this.codeFromStatus(statusCode);

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        const rawMessage = r.message;
        if (Array.isArray(rawMessage)) {
          message = rawMessage.join('; ');
          details = rawMessage;
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
        // Maxsus xato kodi (masalan PAYMENT_REQUIRED) berilgan bo'lsa — saqlaymiz.
        if (typeof r.code === 'string') {
          code = r.code;
        }
      }
    } else if (exception instanceof Error) {
      message = 'Ichki server xatosi';
      this.logger.error(exception.message, exception.stack);
    }

    if (statusCode >= 500 && exception instanceof HttpException) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${message}`,
      );
    }

    // Server xatolari (5xx) Sentry'ga yuboriladi (DSN yoqilgan bo'lsa).
    if (statusCode >= 500) {
      captureException(exception, {
        requestId: getTenantStore()?.requestId,
        method: request.method,
        path: request.url,
      });
    }

    const body: ErrorBody = {
      success: false,
      data: null,
      message,
      error: { code, details },
      statusCode,
      path: request.url,
      requestId: getTenantStore()?.requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private codeFromStatus(status: number): string {
    // HttpStatus enum'ni raqam bilan solishtirmaslik uchun oddiy literal map.
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'TOO_MANY_REQUESTS',
    };
    if (map[status]) return map[status];
    return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

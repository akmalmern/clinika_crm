import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, Paginated } from '../interfaces/api-response.interface';

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Paginated<unknown>).items) &&
    'meta' in value
  );
}

/**
 * Har bir muvaffaqiyatli javobni standart shaklga keltiradi:
 *   { success: true, data, message, meta? }
 *
 * - Service `{ items, meta }` qaytarsa -> data=items, meta=meta (pagination).
 * - `{ data, message }` shaklida qaytsa -> shu message ishlatiladi.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload): ApiResponse<T> => {
        if (isPaginated(payload)) {
          return {
            success: true,
            data: payload.items as T,
            message: null,
            meta: payload.meta as unknown as Record<string, unknown>,
          };
        }

        // Service `{ data, message, meta }` qaytarishi mumkin (ixtiyoriy)
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in (payload as Record<string, unknown>) &&
          'message' in (payload as Record<string, unknown>)
        ) {
          const obj = payload as unknown as {
            data: T;
            message: string | null;
            meta?: Record<string, unknown>;
          };
          return {
            success: true,
            data: obj.data,
            message: obj.message,
            meta: obj.meta,
          };
        }

        return { success: true, data: payload, message: null };
      }),
    );
  }
}

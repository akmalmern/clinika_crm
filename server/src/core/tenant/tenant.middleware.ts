import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithTenant, TenantStore } from './tenant-context';

/**
 * Har bir so'rovni yangi TenantStore (AsyncLocalStorage) ichiga o'raydi. Bu store
 * guard'lar, controller'lar, service'lar va Prisma extension'iga yetib boradi.
 * Autentifikatsiya (JWT strategiyasi) keyinroq store'ga userId/clinicId/role qo'shadi.
 *
 * MUHIM: store'ni eng boshda yaratamiz — request-id va IP/UA audit hamda xato
 * javoblarida ham (auth bo'lmasa ham) kerak.
 *
 * Express-darajadagi funksiya sifatida `app.use(...)` orqali ulanadi (main.ts).
 * Bu NestJS routing'idan oldin ishlaydi va path-to-regexp wildcard'iga bog'liq emas.
 */
export function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerRequestId = req.headers['x-request-id'];
  const requestId =
    (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId) ||
    randomUUID();

  const store: TenantStore = {
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };

  res.setHeader('x-request-id', requestId);

  // next()'ni store kontekstida chaqiramiz — shundan keyingi butun pipeline
  // shu store'ni "ko'radi".
  runWithTenant(store, () => next());
}

/**
 * NestMiddleware ko'rinishidagi o'ramcha (DI/testlar uchun saqlanadi).
 * Amalda ulash main.ts'dagi `app.use(tenantContextMiddleware)` orqali.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    tenantContextMiddleware(req, res, next);
  }
}

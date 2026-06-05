import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { PaymeError } from '../constants/billing.constant';
import { PaymeService } from '../services/payme.service';

/**
 * Payme Merchant API webhook (spec 5.4). JSON-RPC 2.0 — bitta endpoint.
 *  - @Public: JWT talab qilinmaydi (himoya — Basic auth merchant key bilan).
 *  - @Res: javob standart konvertга O'RALMAYDI — Payme aniq JSON-RPC kutadi.
 *  - @SkipThrottle: provayder so'rovlari rate-limit'ga tushmasin.
 * Xavfsizlik: merchant key faqat .env'da; auth muvaffaqiyatsiz -> -32504.
 */
@ApiTags('webhooks')
@Controller('billing/payme')
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Post()
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async handle(
    @Headers('authorization') auth: string | undefined,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const id =
      body && typeof body === 'object' && 'id' in body ? body.id : null;

    if (!this.payme.checkAuth(auth)) {
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: PaymeError.INSUFFICIENT_PRIVILEGE,
          message: {
            ru: 'Недостаточно прав',
            uz: 'Ruxsat yetarli emas',
            en: 'Insufficient privilege',
          },
        },
      });
      return;
    }

    const method = typeof body?.method === 'string' ? body.method : '';
    const params =
      body?.params && typeof body.params === 'object'
        ? (body.params as Record<string, unknown>)
        : {};

    try {
      const out = await this.payme.dispatch(method, params);
      res.json({ jsonrpc: '2.0', id, ...out });
    } catch {
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: PaymeError.CANT_PERFORM,
          message: {
            ru: 'Внутренняя ошибка',
            uz: 'Ichki xato',
            en: 'Internal error',
          },
        },
      });
    }
  }
}

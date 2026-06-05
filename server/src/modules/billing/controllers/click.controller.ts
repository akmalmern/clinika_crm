import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { ClickService } from '../services/click.service';
import type { ClickParams } from '../services/click.service';

/**
 * Click Merchant API webhook (spec 5.4) — Prepare/Complete (form-urlencoded).
 *  - @Public: JWT yo'q (himoya — sign_string MD5).
 *  - @Res: javob standart konvertга o'ralmaydi (Click aniq JSON kutadi).
 *  - @SkipThrottle: provayder so'rovlari uchun.
 * Click ikki URL bilan sozlanadi (Prepare / Complete); ikkalasi ham `action`
 * maydoni bilan bir xil servisга yo'naltiriladi. Imzo `action` bilan tekshiriladi,
 * shu sababli endpoint action'ni qayta yozmaydi.
 */
@ApiTags('webhooks')
@Controller('billing/click')
export class ClickController {
  constructor(private readonly click: ClickService) {}

  @Post('prepare')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async prepare(
    @Body() body: ClickParams,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200).json(await this.click.handle(body));
  }

  @Post('complete')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async complete(
    @Body() body: ClickParams,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200).json(await this.click.handle(body));
  }
}

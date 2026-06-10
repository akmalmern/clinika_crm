import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint'i: `GET /metrics` (autentifikatsiyasiz). Prod'da
 * Nginx/firewall orqali ichki tarmoq bilan cheklang. METRICS_ENABLED=false
 * bo'lsa 404.
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('metrics')
  @ApiExcludeEndpoint()
  async scrape(@Res() res: Response): Promise<void> {
    if (!this.metrics.enabled) {
      throw new NotFoundException();
    }
    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.metrics());
  }
}

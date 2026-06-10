import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';
import { ObservabilityConfig } from '../../config/configuration';

/**
 * Prometheus metrikalari (spec 10). Alohida Registry — global default'ni
 * ifloslantirmaydi (test/hot-reload xavfsiz). Asosiy metrikalar:
 *  - http_requests_total (method/route/status)
 *  - http_request_duration_seconds (histogram)
 *  - default Node/process metrikalari (CPU, RSS, event-loop lag, ...).
 */
@Injectable()
export class MetricsService {
  readonly enabled: boolean;
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;

  constructor(config: ConfigService) {
    this.enabled =
      config.getOrThrow<ObservabilityConfig>('observability').metricsEnabled;

    this.registry.setDefaultLabels({ app: 'clinic-crm-api' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Jami HTTP so`rovlar soni',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP so`rov davomiyligi (sekund)',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    if (this.enabled) {
      collectDefaultMetrics({ register: this.registry });
    }
  }

  /** Bitta HTTP so'rovni qayd etadi. */
  observe(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    if (!this.enabled) return;
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}

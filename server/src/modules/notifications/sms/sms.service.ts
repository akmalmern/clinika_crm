import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationConfig } from '../../../config/configuration';
import { SmsProvider, SmsResult } from './sms-provider.interface';
import { LogSmsProvider } from './log-sms.provider';
import { EskizProvider } from './eskiz.provider';

/**
 * SMS yuborish — konfiguratsiyaga ko'ra provayder tanlaydi (log/eskiz).
 * Provayder abstraksiyasi: AWS/boshqa provayderga o'tish oson (spec 11).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');
  private readonly provider: SmsProvider;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<NotificationConfig>('notification');
    if (cfg.smsProvider === 'eskiz') {
      this.provider = new EskizProvider(cfg.eskiz);
    } else {
      this.provider = new LogSmsProvider();
    }
    this.logger.log(`SMS provayderi: ${this.provider.name}`);
  }

  send(phone: string, text: string): Promise<SmsResult> {
    if (!phone) return Promise.resolve({ ok: false, error: 'telefon yo`q' });
    return this.provider.send(phone, text);
  }
}

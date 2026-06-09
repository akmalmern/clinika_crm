import { Logger } from '@nestjs/common';
import { SmsProvider, SmsResult } from './sms-provider.interface';

/**
 * Dev/test SMS provayderi — faqat loglaydi (haqiqiy SMS yubormaydi). SMS kalitlari
 * bo'lmaganda ham navbat ishlashda davom etadi.
 */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  private readonly logger = new Logger('SMS');

  send(phone: string, text: string): Promise<SmsResult> {
    this.logger.log(`[SMS->${phone}] ${text}`);
    return Promise.resolve({ ok: true, id: 'log' });
  }
}

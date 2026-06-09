import { Logger } from '@nestjs/common';
import {
  normalizePhone,
  SmsProvider,
  SmsResult,
} from './sms-provider.interface';

export interface EskizConfig {
  baseUrl: string;
  email: string;
  password: string;
  from: string;
}

/**
 * Eskiz.uz SMS provayderi. Auth: email+parol -> token (keshlanadi). Yuborish:
 * /message/sms/send. 401 bo'lsa token yangilanadi. Node 20 global fetch.
 * Kalitlar faqat .env'da (spec 10).
 */
export class EskizProvider implements SmsProvider {
  readonly name = 'eskiz';
  private readonly logger = new Logger('Eskiz');
  private token: string | null = null;

  constructor(private readonly cfg: EskizConfig) {}

  async send(phone: string, text: string): Promise<SmsResult> {
    if (!this.cfg.email || !this.cfg.password) {
      return { ok: false, error: 'Eskiz kalitlari sozlanmagan' };
    }
    try {
      const body = await this.sendOnce(phone, text);
      return body;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Eskiz yuborish xatosi: ${msg}`);
      // BullMQ qayta urinishi uchun xatoni ko'tarib yuboramiz.
      throw err;
    }
  }

  private async sendOnce(phone: string, text: string): Promise<SmsResult> {
    const token = await this.ensureToken();
    const form = new URLSearchParams({
      mobile_phone: normalizePhone(phone),
      message: text,
      from: this.cfg.from,
    });
    let res = await fetch(`${this.cfg.baseUrl}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (res.status === 401) {
      // Token eskirgan -> yangilab qayta urinish
      this.token = null;
      const fresh = await this.ensureToken();
      res = await fetch(`${this.cfg.baseUrl}/message/sms/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${fresh}` },
        body: form,
      });
    }
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: data.id };
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    const form = new URLSearchParams({
      email: this.cfg.email,
      password: this.cfg.password,
    });
    const res = await fetch(`${this.cfg.baseUrl}/auth/login`, {
      method: 'POST',
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { token?: string };
    };
    const token = data.data?.token;
    if (!res.ok || !token) {
      throw new Error('Eskiz auth muvaffaqiyatsiz');
    }
    this.token = token;
    return token;
  }
}

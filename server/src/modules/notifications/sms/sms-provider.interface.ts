/** SMS provayder abstraksiyasi (spec 11/12). Yangi provayder qo'shish oson. */
export interface SmsResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(phone: string, text: string): Promise<SmsResult>;
}

/** Telefonni provayder kutgan formatga keltiradi (faqat raqamlar, 998...). */
export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/\D/g, '');
  if (p.length === 9) p = '998' + p; // 901234567 -> 998901234567
  return p;
}

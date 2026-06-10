/**
 * Ko'rsatish formatlari. Vaqt bazada UTC, foydalanuvchiga Asia/Tashkent'da
 * ko'rsatiladi (spec 1.5). Pul Decimal string sifatida keladi — Float'ga
 * AYLANTIRILMAYDI, faqat ko'rsatish uchun guruhlab formatlanadi.
 */
const TZ = 'Asia/Tashkent';

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** Decimal string/number -> "1 250 000 so'm" (Float EMAS — string ustida ishlaydi). */
export function formatMoney(value?: string | number | null, currency = "so'm"): string {
  if (value === null || value === undefined || value === '') return `0 ${currency}`;
  const raw = String(value);
  const neg = raw.startsWith('-');
  const [intPartRaw, decPart] = raw.replace('-', '').split('.');
  const intPart = (intPartRaw || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const dec = decPart && Number(decPart) > 0 ? `.${decPart}` : '';
  return `${neg ? '-' : ''}${intPart}${dec} ${currency}`;
}

/** UTC sana -> mahalliy (Tashkent) "YYYY-MM-DD" (date input qiymati uchun). */
export function toLocalDateValue(value?: string | Date | null): string {
  const d = value ? (value instanceof Date ? value : new Date(value)) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  // en-CA -> YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** Tug'ilgan sanadan yosh (yil). */
export function ageFromBirthDate(value?: string | Date | null): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

/** Klinika vaqt offseti (Asia/Tashkent, DST yo'q). */
export const LOCAL_TZ_OFFSET = '+05:00';

/** Mahalliy kun (YYYY-MM-DD) -> UTC [from, to) oralig'i (qabullar so'rovi uchun). */
export function localDayRangeUtc(dateStr: string): { from: string; to: string } {
  const from = new Date(`${dateStr}T00:00:00${LOCAL_TZ_OFFSET}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Sanani N kun siljitadi (mahalliy), YYYY-MM-DD qaytaradi. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00${LOCAL_TZ_OFFSET}`);
  return toLocalDateValue(new Date(d.getTime() + n * 86400000));
}

/** Tanlangan sananing haftasidagi 7 kun (Dushanba..Yakshanba), YYYY-MM-DD. */
export function weekDays(dateStr: string): string[] {
  const base = new Date(`${dateStr}T12:00:00${LOCAL_TZ_OFFSET}`);
  const dow = (base.getUTCDay() + 6) % 7; // 0=Dushanba
  const monday = new Date(base.getTime() - dow * 86400000);
  return Array.from({ length: 7 }, (_, i) =>
    toLocalDateValue(new Date(monday.getTime() + i * 86400000)),
  );
}

/** "Dushanba, 10-iyun" kabi qisqa sarlavha. */
export function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00${LOCAL_TZ_OFFSET}`);
  return new Intl.DateTimeFormat('uz-UZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(d);
}

/** Fayl hajmi (bayt string) -> "1.2 MB". */
export function formatFileSize(bytes?: string | number | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

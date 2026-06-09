/**
 * Vaqt/slot yordamchilari (sof funksiyalar — DB'siz, unit test qilinadi).
 * Klinika mahalliy vaqti UTC+offsetMinutes (Asia/Tashkent = 300). Baza UTC saqlaydi.
 */

/** "HH:MM" -> kun boshidan daqiqa. Noto'g'ri bo'lsa NaN. */
export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return NaN;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/** Daqiqani "HH:MM" ko'rinishiga. */
export function formatHm(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface LocalParts {
  weekday: number; // 0=Yakshanba .. 6=Shanba
  minuteOfDay: number; // mahalliy kun boshidan daqiqa
}

/** UTC instant -> klinika mahalliy (weekday + kun daqiqasi). */
export function toLocalParts(utc: Date, offsetMinutes: number): LocalParts {
  const local = new Date(utc.getTime() + offsetMinutes * 60_000);
  return {
    weekday: local.getUTCDay(),
    minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/**
 * Mahalliy kalendar sana ('YYYY-MM-DD') + mahalliy daqiqa -> UTC instant.
 * UTC = mahalliyDevor - offset.
 */
export function utcFromLocalDateMinute(
  dateStr: string,
  minute: number,
  offsetMinutes: number,
): Date {
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  const localWallMs = Date.UTC(y, mo - 1, d, 0, 0, 0) + minute * 60_000;
  return new Date(localWallMs - offsetMinutes * 60_000);
}

/** Mahalliy kalendar sananing hafta kuni (offsetга bog'liq emas — sananing o'zi). */
export function weekdayOfLocalDate(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/**
 * [startMin, endMin) oynasidan slotMin qadamli slot boshlanishlari.
 * Faqat to'liq sig'adigan slotlar (start + slotMin <= endMin).
 */
export function slotStartsForWindow(
  startMin: number,
  endMin: number,
  slotMin: number,
): number[] {
  const out: number[] = [];
  if (slotMin <= 0) return out;
  for (let m = startMin; m + slotMin <= endMin; m += slotMin) {
    out.push(m);
  }
  return out;
}

/** Ikki [aStart,aEnd) va [bStart,bEnd) oraliq kesishadimi (yarim ochiq). */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

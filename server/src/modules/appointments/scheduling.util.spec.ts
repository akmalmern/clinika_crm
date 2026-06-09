import {
  parseHm,
  formatHm,
  slotStartsForWindow,
  toLocalParts,
  utcFromLocalDateMinute,
  weekdayOfLocalDate,
  rangesOverlap,
} from './scheduling.util';

describe('scheduling.util (sof)', () => {
  it('parseHm / formatHm', () => {
    expect(parseHm('09:00')).toBe(540);
    expect(parseHm('18:30')).toBe(1110);
    expect(parseHm('24:00')).toBeNaN();
    expect(formatHm(540)).toBe('09:00');
    expect(formatHm(1110)).toBe('18:30');
  });

  it('slotStartsForWindow: faqat to`liq sig`adigan slotlar', () => {
    // 09:00-10:00, 30 daqiqa -> 540, 570
    expect(slotStartsForWindow(540, 600, 30)).toEqual([540, 570]);
    // 09:00-09:50, 30 -> faqat 540 (570+30=600 > 590)
    expect(slotStartsForWindow(540, 590, 30)).toEqual([540]);
  });

  it('toLocalParts: UTC -> Tashkent (UTC+5)', () => {
    // 2026-06-10 04:00 UTC = 09:00 mahalliy, chorshanba (weekday 3)
    const p = toLocalParts(new Date('2026-06-10T04:00:00Z'), 300);
    expect(p.weekday).toBe(3);
    expect(p.minuteOfDay).toBe(540); // 09:00
  });

  it('utcFromLocalDateMinute: mahalliy -> UTC (offset ayiriladi)', () => {
    // 2026-06-10 09:00 mahalliy (UTC+5) -> 04:00 UTC
    const utc = utcFromLocalDateMinute('2026-06-10', 540, 300);
    expect(utc.toISOString()).toBe('2026-06-10T04:00:00.000Z');
  });

  it('weekdayOfLocalDate', () => {
    expect(weekdayOfLocalDate('2026-06-10')).toBe(3); // chorshanba
    expect(weekdayOfLocalDate('2026-06-07')).toBe(0); // yakshanba
  });

  it('rangesOverlap (yarim ochiq)', () => {
    const a1 = new Date('2026-06-10T09:00:00Z');
    const a2 = new Date('2026-06-10T09:30:00Z');
    const b1 = new Date('2026-06-10T09:15:00Z');
    const b2 = new Date('2026-06-10T09:45:00Z');
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(true);
    // tegib turadi (09:30 == 09:30) -> kesishmaydi
    const c1 = new Date('2026-06-10T09:30:00Z');
    const c2 = new Date('2026-06-10T10:00:00Z');
    expect(rangesOverlap(a1, a2, c1, c2)).toBe(false);
  });
});

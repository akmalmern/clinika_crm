/**
 * Qabul holatlari (spec 7.6) — DB enum EMAS (spec 1.6.A), string + validatsiya.
 * NO_SHOW (kelmadi) — ML uchun muhim belgi (spec 11.5).
 */
export const AppointmentStatus = {
  PENDING: 'PENDING', // kutilmoqda
  ARRIVED: 'ARRIVED', // keldi
  IN_PROGRESS: 'IN_PROGRESS', // qabulda
  COMPLETED: 'COMPLETED', // yakunlangan
  CANCELLED: 'CANCELLED', // bekor
  NO_SHOW: 'NO_SHOW', // kelmadi
} as const;
export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
export const ALL_APPOINTMENT_STATUSES: string[] =
  Object.values(AppointmentStatus);

/**
 * Ruxsat etilgan holat o'tishlari (state machine). Noto'g'ri o'tish rad etiladi.
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  [AppointmentStatus.PENDING]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.ARRIVED]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export function canTransition(from: string, to: string): boolean {
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/** Slotni band qiluvchi (faol) holatlar — bekor/kelmadi bo'lmagan. */
export const BLOCKING_STATUSES: string[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.ARRIVED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

/** Default qabul davomiyligi (daqiqa) — xizmat duration'i bo'lmasa. */
export const DEFAULT_APPOINTMENT_MINUTES = 30;

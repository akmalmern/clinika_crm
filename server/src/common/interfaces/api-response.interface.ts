/**
 * Standart javob formati (spec 9-bo'lim): { success, data, message, meta }.
 * Barcha muvaffaqiyatli javoblar ResponseInterceptor orqali shu shaklga keltiriladi.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Pagination meta — ro'yxat qaytaruvchi endpoint'lar uchun standart.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Service'lar ro'yxat qaytarganda shu shaklni qaytarsa,
 * ResponseInterceptor `meta`ni avtomatik ajratib oladi.
 */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

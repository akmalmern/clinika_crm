/** Backend standart javob konverti (spec 9): { success, data, message, meta }. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string | null;
  meta?: Record<string, unknown>;
}

/** Pagination meta — ro'yxat endpoint'lari uchun. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Backend xato konverti. `error.code` (masalan PAYMENT_REQUIRED) muhim. */
export interface ApiError {
  success: false;
  data: null;
  message: string;
  error?: { code?: string; details?: string[] };
  statusCode?: number;
}

'use client';

import axios, { AxiosError } from 'axios';
import type { ApiResponse, PaginationMeta } from '@/types/api';

/**
 * Brauzer API klienti. SAME-ORIGIN `/api/backend/*` (Next BFF proxy) ga boradi —
 * proxy httpOnly cookie'dagi tokenni qo'shadi va 401'da avtomatik refresh qiladi.
 * Brauzer JS hech qachon token ko'rmaydi (localStorage YO'Q — spec 10/12).
 */
export const api = axios.create({
  baseURL: '/api/backend',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      const code = (error.response?.data as { error?: { code?: string } })
        ?.error?.code;
      if (status === 403 && code === 'PAYMENT_REQUIRED') {
        window.location.href = '/clinic/billing/suspended';
      } else if (status === 401) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Javob konvertidan `data` ni ochib beradi. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get<ApiResponse<T>>(path);
  return res.data.data as T;
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Ro'yxat (pagination) — `data` (items) + `meta`. */
export async function apiGetPage<T>(path: string): Promise<Page<T>> {
  const res = await api.get<ApiResponse<T[]>>(path);
  const meta = (res.data.meta as unknown as PaginationMeta) ?? {
    page: 1,
    limit: 20,
    total: res.data.data?.length ?? 0,
    totalPages: 1,
  };
  return { items: (res.data.data as T[]) ?? [], meta };
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.post<ApiResponse<T>>(path, body);
  return res.data.data as T;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.patch<ApiResponse<T>>(path, body);
  return res.data.data as T;
}

export async function apiDelete<T = null>(path: string): Promise<T> {
  const res = await api.delete<ApiResponse<T>>(path);
  return res.data.data as T;
}

/** Multipart yuklash (fayl + qo'shimcha maydonlar). */
export async function apiUpload<T>(
  path: string,
  file: File | Blob,
  fields?: Record<string, string>,
  fileName?: string,
): Promise<T> {
  const form = new FormData();
  form.append('file', file, fileName ?? (file as File).name ?? 'upload');
  if (fields) {
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
  }
  const res = await api.post<ApiResponse<T>>(path, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as T;
}

export interface SignedUrl {
  url: string;
  expiresIn: number;
}

/** Fayl uchun vaqtinchalik signed URL (rasm/preview/yuklab olish). */
export async function getFileUrl(fileId: string): Promise<string> {
  const res = await apiGet<SignedUrl>(`/files/${fileId}/url`);
  return res.url;
}

/** Backend xatosidan o'qiladigan xabar (toast uchun). */
export function apiErrorMessage(err: unknown, fallback = 'Xatolik yuz berdi'): string {
  const e = err as AxiosError<ApiResponse & { error?: { details?: string[] } }>;
  const data = e?.response?.data as
    | { message?: string; error?: { details?: string[] } }
    | undefined;
  if (data?.error?.details?.length) return data.error.details[0];
  if (data?.message) return data.message;
  if (e?.message) return e.message;
  return fallback;
}

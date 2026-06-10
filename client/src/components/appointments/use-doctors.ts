'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet, apiGetPage } from '@/lib/api/client';
import type { DoctorSchedule, Member } from '@/types/domain';

export interface DoctorOption {
  id: string; // user id (appointments doctorId)
  name: string;
}

/**
 * Shifokorlar ro'yxati. CLINIC_ADMIN `/clinic/members` orqali to'liq nom oladi.
 * Boshqa rollarda (RECEPTIONIST) members 403 -> zaxira sifatida ish jadvalidan
 * (SCHEDULE_READ) shifokor ID'lari olinadi (nom o'rniga qisqa ID). Backend
 * o'zgartirilmaydi.
 */
export function useDoctors() {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: async (): Promise<DoctorOption[]> => {
      try {
        const page = await apiGetPage<Member>(
          '/clinic/members?role=DOCTOR&limit=100',
        );
        return page.items.map((m) => ({ id: m.userId, name: m.fullName }));
      } catch {
        // Zaxira: ish jadvalidagi noyob shifokorlar (nom yo'q).
        const schedules = await apiGet<DoctorSchedule[]>(
          '/clinic/doctor-schedules',
        );
        const seen = new Set<string>();
        const out: DoctorOption[] = [];
        for (const s of schedules) {
          if (!seen.has(s.doctorId)) {
            seen.add(s.doctorId);
            out.push({ id: s.doctorId, name: `Shifokor ${s.doctorId.slice(0, 6)}` });
          }
        }
        return out;
      }
    },
    staleTime: 5 * 60_000,
  });
}

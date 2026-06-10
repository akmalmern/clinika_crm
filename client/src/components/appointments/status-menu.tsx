'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiErrorMessage, apiPost } from '@/lib/api/client';
import { APPOINTMENT_STATUS_LABEL, STATUS_TRANSITIONS } from '@/lib/constants';
import type { Appointment } from '@/types/domain';

/** Qabul holatini o'zgartirish (ruxsat etilgan o'tishlar bo'yicha). */
export function StatusMenu({ appointment }: { appointment: Appointment }) {
  const qc = useQueryClient();
  const next = STATUS_TRANSITIONS[appointment.status] ?? [];

  const change = useMutation({
    mutationFn: (status: string) =>
      apiPost(`/clinic/appointments/${appointment.id}/status`, { status }),
    onSuccess: () => {
      toast.success('Holat yangilandi');
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (next.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={change.isPending}>
          Holat
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {next.map((s) => (
          <DropdownMenuItem key={s} onClick={() => change.mutate(s)}>
            {APPOINTMENT_STATUS_LABEL[s] ?? s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

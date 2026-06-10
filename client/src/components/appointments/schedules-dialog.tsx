'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { EmptyState, LoadingState } from '@/components/common/states';
import { apiDelete, apiErrorMessage, apiGet, apiPost } from '@/lib/api/client';
import { WEEKDAYS } from '@/lib/constants';
import type { DoctorSchedule } from '@/types/domain';
import { useDoctors } from './use-doctors';

const weekdayLabel = (w: number) =>
  WEEKDAYS.find((d) => d.value === w)?.label ?? String(w);

export function SchedulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const doctors = useDoctors();
  const [doctorId, setDoctorId] = useState('');

  const [weekday, setWeekday] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slotMinutes, setSlotMinutes] = useState('30');

  const query = useQuery({
    queryKey: ['doctor-schedules', doctorId],
    queryFn: () =>
      apiGet<DoctorSchedule[]>(
        `/clinic/doctor-schedules?doctorId=${doctorId}`,
      ),
    enabled: open && !!doctorId,
  });

  const add = useMutation({
    mutationFn: () =>
      apiPost('/clinic/doctor-schedules', {
        doctorId,
        weekday: Number(weekday),
        startTime,
        endTime,
        slotMinutes: Number(slotMinutes),
      }),
    onSuccess: () => {
      toast.success("Ish vaqti qo'shildi");
      qc.invalidateQueries({ queryKey: ['doctor-schedules', doctorId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/clinic/doctor-schedules/${id}`),
    onSuccess: () => {
      toast.success("O'chirildi");
      qc.invalidateQueries({ queryKey: ['doctor-schedules', doctorId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shifokor ish jadvali</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Shifokor">
            <Select value={doctorId || undefined} onValueChange={setDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="Tanlang" />
              </SelectTrigger>
              <SelectContent>
                {doctors.data?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {doctorId && (
            <>
              {query.isLoading ? (
                <LoadingState />
              ) : !query.data?.length ? (
                <EmptyState
                  title="Ish vaqti belgilanmagan"
                  description="Quyida hafta kuni va vaqtni qo'shing."
                />
              ) : (
                <ul className="divide-y rounded-md border">
                  {query.data.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 p-2.5 text-sm"
                    >
                      <span className="w-28 font-medium">
                        {weekdayLabel(s.weekday)}
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {s.startTime}–{s.endTime} · {s.slotMinutes} daq
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove.mutate(s.id)}
                        aria-label="O'chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid items-end gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <FormField label="Kun">
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Boshlanish">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </FormField>
                <FormField label="Tugash">
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </FormField>
                <FormField label="Slot (daq)">
                  <Input
                    type="number"
                    min={5}
                    value={slotMinutes}
                    onChange={(e) => setSlotMinutes(e.target.value)}
                  />
                </FormField>
                <Button onClick={() => add.mutate()} disabled={add.isPending}>
                  {add.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Qo&apos;shish
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

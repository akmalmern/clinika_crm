'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiGet, apiGetPage, apiPost } from '@/lib/api/client';
import { toLocalDateValue } from '@/lib/format';
import type { FreeSlot, Patient, Service } from '@/types/domain';
import { PatientCombobox } from './patient-combobox';
import { useDoctors } from './use-doctors';

const NONE = '__none__';

export function BookingDialog({
  open,
  onOpenChange,
  defaultDoctorId,
  defaultDate,
  defaultSlotStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDoctorId?: string;
  defaultDate?: string;
  defaultSlotStart?: string;
}) {
  const qc = useQueryClient();
  const doctors = useDoctors();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [serviceId, setServiceId] = useState(NONE);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPatient(null);
      setDoctorId(defaultDoctorId ?? '');
      setDate(defaultDate ?? toLocalDateValue(new Date()));
      setSlotStart(defaultSlotStart ?? '');
      setServiceId(NONE);
      setNotes('');
    }
  }, [open, defaultDoctorId, defaultDate, defaultSlotStart]);

  const services = useQuery({
    queryKey: ['services-active'],
    queryFn: () => apiGetPage<Service>('/clinic/services?limit=100'),
    enabled: open,
  });

  const slots = useQuery({
    queryKey: ['free-slots', doctorId, date],
    queryFn: () =>
      apiGet<FreeSlot[]>(
        `/clinic/appointments/free-slots?doctorId=${doctorId}&date=${date}`,
      ),
    enabled: open && !!doctorId && !!date,
  });

  const book = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {
        patientId: patient!.id,
        doctorId,
        scheduledAt: slotStart,
      };
      if (serviceId !== NONE) body.serviceId = serviceId;
      if (notes.trim()) body.notes = notes.trim();
      return apiPost('/clinic/appointments', body);
    },
    onSuccess: () => {
      toast.success("Qabul qo'shildi");
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['free-slots'] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(apiErrorMessage(e, 'Qabulni saqlab bo`lmadi')),
  });

  function submit() {
    if (!patient) return toast.error('Bemorni tanlang');
    if (!doctorId) return toast.error('Shifokorni tanlang');
    if (!slotStart) return toast.error('Vaqtni tanlang');
    book.mutate();
  }

  const slotList = slots.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yangi qabul</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Bemor" required>
            <PatientCombobox
              value={patient?.id}
              label={patient?.fullName}
              onSelect={setPatient}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Shifokor" required>
              <Select
                value={doctorId || undefined}
                onValueChange={(v) => {
                  setDoctorId(v);
                  setSlotStart('');
                }}
              >
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

            <FormField label="Sana" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlotStart('');
                }}
              />
            </FormField>
          </div>

          <FormField
            label="Bo'sh vaqt"
            required
            hint={
              !doctorId || !date
                ? 'Avval shifokor va sanani tanlang'
                : slots.isLoading
                  ? 'Yuklanmoqda...'
                  : slotList.length === 0
                    ? "Bu kunda bo'sh slot yo'q"
                    : undefined
            }
          >
            <Select
              value={slotStart || undefined}
              onValueChange={setSlotStart}
              disabled={!doctorId || !date || slotList.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vaqtni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {slotList.map((s) => (
                  <SelectItem key={s.start} value={s.start}>
                    {s.startLocal}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Xizmat">
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Xizmatsiz</SelectItem>
                {services.data?.items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Izoh">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={book.isPending}>
            {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiErrorMessage, apiPatch, apiPost } from '@/lib/api/client';
import { BLOOD_TYPES, GENDERS, GENDER_LABEL } from '@/lib/constants';
import { toLocalDateValue } from '@/lib/format';
import type { Patient } from '@/types/domain';

const schema = z.object({
  fullName: z.string().min(1, 'Ism majburiy').max(200),
  phone: z.string().max(30).optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  bloodType: z.string().optional(),
  address: z.string().max(500).optional(),
  allergies: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

function clean(v: Values): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val && String(val).trim()) out[k] = String(val).trim();
  }
  return out;
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient?: Patient | null;
  onSaved?: (p: Patient) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!patient;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        fullName: patient?.fullName ?? '',
        phone: patient?.phone ?? '',
        birthDate: patient?.birthDate ? toLocalDateValue(patient.birthDate) : '',
        gender: patient?.gender ?? '',
        bloodType: patient?.bloodType ?? '',
        address: patient?.address ?? '',
        allergies: patient?.allergies ?? '',
        notes: patient?.notes ?? '',
      });
    }
  }, [open, patient, reset]);

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const body = clean(values);
      return isEdit
        ? apiPatch<Patient>(`/clinic/patients/${patient!.id}`, body)
        : apiPost<Patient>('/clinic/patients', body);
    },
    onSuccess: (p) => {
      toast.success(isEdit ? 'Bemor yangilandi' : "Bemor qo'shildi");
      qc.invalidateQueries({ queryKey: ['patients'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['patient', patient!.id] });
      onOpenChange(false);
      onSaved?.(p);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Bemorni tahrirlash' : "Yangi bemor qo'shish"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <FormField
            label="F.I.O."
            htmlFor="fullName"
            required
            error={errors.fullName?.message}
            className="sm:col-span-2"
          >
            <Input id="fullName" {...register('fullName')} />
          </FormField>

          <FormField label="Telefon" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="+998..." {...register('phone')} />
          </FormField>

          <FormField label="Tug'ilgan sana" htmlFor="birthDate">
            <Input id="birthDate" type="date" {...register('birthDate')} />
          </FormField>

          <FormField label="Jins">
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField label="Qon guruhi">
            <Controller
              control={control}
              name="bloodType"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Manzil"
            htmlFor="address"
            error={errors.address?.message}
            className="sm:col-span-2"
          >
            <Input id="address" {...register('address')} />
          </FormField>

          <FormField
            label="Allergiya"
            htmlFor="allergies"
            error={errors.allergies?.message}
            className="sm:col-span-2"
          >
            <Textarea id="allergies" rows={2} {...register('allergies')} />
          </FormField>

          <FormField
            label="Eslatma"
            htmlFor="notes"
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea id="notes" rows={2} {...register('notes')} />
          </FormField>

          <DialogFooter className="gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiPatch, apiPost } from '@/lib/api/client';
import type { MedicalRecord } from '@/types/domain';

const schema = z.object({
  complaints: z.string().max(5000).optional(),
  diagnosis: z.string().max(5000).optional(),
  icdCode: z.string().max(20).optional(),
  treatment: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});
type Values = z.infer<typeof schema>;

export function MedicalRecordDialog({
  open,
  onOpenChange,
  patientId,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  record?: MedicalRecord | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!record;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        complaints: record?.complaints ?? '',
        diagnosis: record?.diagnosis ?? '',
        icdCode: record?.icdCode ?? '',
        treatment: record?.treatment ?? '',
        notes: record?.notes ?? '',
      });
    }
  }, [open, record, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string> = {};
      for (const [k, val] of Object.entries(v))
        if (val && val.trim()) body[k] = val.trim();
      return isEdit
        ? apiPatch(`/clinic/medical-records/${record!.id}`, body)
        : apiPost('/clinic/medical-records', { patientId, ...body });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Yozuv yangilandi' : "Ko'rik saqlandi");
      qc.invalidateQueries({ queryKey: ['patient-history', patientId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ko'rikni tahrirlash" : "Yangi ko'rik yozuvi"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <FormField label="Shikoyatlar" htmlFor="complaints" error={errors.complaints?.message}>
            <Textarea id="complaints" rows={2} {...register('complaints')} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <FormField label="Tashxis" htmlFor="diagnosis" error={errors.diagnosis?.message}>
              <Textarea id="diagnosis" rows={2} {...register('diagnosis')} />
            </FormField>
            <FormField label="ICD-10 kod" htmlFor="icdCode" error={errors.icdCode?.message}>
              <Input id="icdCode" placeholder="J06.9" {...register('icdCode')} />
            </FormField>
          </div>

          <FormField label="Davolash" htmlFor="treatment" error={errors.treatment?.message}>
            <Textarea id="treatment" rows={2} {...register('treatment')} />
          </FormField>

          <FormField label="Eslatma" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </FormField>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

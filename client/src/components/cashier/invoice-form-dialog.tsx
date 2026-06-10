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
import { apiErrorMessage, apiPost } from '@/lib/api/client';

const schema = z.object({
  amount: z
    .string()
    .min(1, 'Summa majburiy')
    .regex(/^\d+(\.\d{1,2})?$/, 'Summa musbat son (masalan 150000)'),
  notes: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

/** Bemorga yangi xizmat hisob-fakturasi yaratish. */
export function InvoiceFormDialog({
  open,
  onOpenChange,
  patientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ amount: '', notes: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string> = { patientId, amount: v.amount };
      if (v.notes?.trim()) body.notes = v.notes.trim();
      return apiPost('/clinic/patient-invoices', body);
    },
    onSuccess: () => {
      toast.success("Hisob-faktura yaratildi");
      qc.invalidateQueries({ queryKey: ['patient-invoices', patientId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi hisob-faktura</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <FormField
            label="Summa (so'm)"
            htmlFor="amount"
            required
            error={errors.amount?.message}
          >
            <Input id="amount" inputMode="decimal" {...register('amount')} />
          </FormField>
          <FormField label="Izoh" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </FormField>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

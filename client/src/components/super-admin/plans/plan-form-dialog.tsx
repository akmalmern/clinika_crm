'use client';

import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiPatch, apiPost } from '@/lib/api/client';
import { BILLING_CYCLES, BILLING_CYCLE_LABEL } from '@/lib/constants';
import type { Plan } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Nom majburiy').max(100),
  price: z
    .string()
    .min(1, 'Narx majburiy')
    .regex(/^\d+(\.\d{1,2})?$/, 'Narx musbat son'),
  maxStaff: z.string().optional(),
  maxPatients: z.string().optional(),
  storageGb: z.string().optional(),
  smsCount: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const numOrUndef = (v?: string) =>
  v && v.trim() !== '' ? Number(v) : undefined;

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan?: Plan | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!plan;
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [pharmacy, setPharmacy] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: plan?.name ?? '',
        price: plan?.price ?? '',
        maxStaff: plan?.limits?.maxStaff?.toString() ?? '',
        maxPatients: plan?.limits?.maxPatients?.toString() ?? '',
        storageGb: plan?.limits?.storageGb?.toString() ?? '',
        smsCount: plan?.limits?.smsCount?.toString() ?? '',
      });
      setBillingCycle(plan?.billingCycle ?? 'MONTHLY');
      setPharmacy(!!plan?.features?.pharmacy);
      setTelegram(!!plan?.features?.telegram);
      setIsActive(plan?.isActive ?? true);
    }
  }, [open, plan, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name.trim(),
        price: v.price,
        billingCycle,
        isActive,
        limits: {
          maxStaff: numOrUndef(v.maxStaff),
          maxPatients: numOrUndef(v.maxPatients),
          storageGb: numOrUndef(v.storageGb),
          smsCount: numOrUndef(v.smsCount),
        },
        features: { pharmacy, telegram },
      };
      return isEdit
        ? apiPatch(`/super-admin/plans/${plan!.id}`, body)
        : apiPost('/super-admin/plans', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Tarif yangilandi' : 'Tarif yaratildi');
      qc.invalidateQueries({ queryKey: ['plans'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tarifni tahrirlash' : 'Yangi tarif'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Nomi" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="BASIC" {...register('name')} />
            </FormField>
            <FormField label="Narx (so'm)" htmlFor="price" required error={errors.price?.message}>
              <Input id="price" inputMode="decimal" {...register('price')} />
            </FormField>
            <FormField label="Sikl">
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {BILLING_CYCLE_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Limitlar
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              <FormField label="Xodimlar">
                <Input type="number" min={0} {...register('maxStaff')} />
              </FormField>
              <FormField label="Bemorlar">
                <Input type="number" min={0} {...register('maxPatients')} />
              </FormField>
              <FormField label="Xotira (GB)">
                <Input type="number" min={0} {...register('storageGb')} />
              </FormField>
              <FormField label="SMS soni">
                <Input type="number" min={0} {...register('smsCount')} />
              </FormField>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Imkoniyatlar
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow label="Dorixona" checked={pharmacy} onChange={setPharmacy} />
              <ToggleRow label="Telegram" checked={telegram} onChange={setTelegram} />
              <ToggleRow label="Faol" checked={isActive} onChange={setIsActive} />
            </div>
          </div>

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

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

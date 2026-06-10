'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Pill, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiErrorMessage, apiPost } from '@/lib/api/client';
import type { Prescription } from '@/types/domain';

const schema = z.object({
  drugName: z.string().min(1, 'Dori nomi majburiy'),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** Bir ko'rikning retseptlari: ro'yxat + qator qo'shish/o'chirish (EMR_MANAGE). */
export function PrescriptionsManager({
  recordId,
  items,
  canManage,
  onChanged,
}: {
  recordId: string;
  items: Prescription[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { drugName: '' },
  });

  const add = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string> = {};
      for (const [k, val] of Object.entries(v))
        if (val && val.trim()) body[k] = val.trim();
      return apiPost(`/clinic/medical-records/${recordId}/prescriptions`, body);
    },
    onSuccess: () => {
      reset({ drugName: '' });
      onChanged();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) =>
      apiDelete(`/clinic/medical-records/${recordId}/prescriptions/${itemId}`),
    onSuccess: onChanged,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2.5 text-sm">
              <Pill className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{p.drugName}</span>
                <span className="text-muted-foreground">
                  {[p.dosage, p.frequency, p.duration]
                    .filter(Boolean)
                    .map((x) => ` · ${x}`)
                    .join('')}
                </span>
                {p.instructions && (
                  <p className="text-xs text-muted-foreground">{p.instructions}</p>
                )}
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => remove.mutate(p.id)}
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Retsept qo&apos;shilmagan.</p>
      )}

      {canManage && (
        <form
          onSubmit={handleSubmit((v) => add.mutate(v))}
          className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
        >
          <Input placeholder="Dori nomi *" {...register('drugName')} />
          <Input placeholder="Doza (500 mg)" {...register('dosage')} />
          <Input placeholder="Chastota" {...register('frequency')} />
          <Input placeholder="Muddat" {...register('duration')} />
          <Button type="submit" size="icon" disabled={add.isPending} aria-label="Qo'shish">
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
          {errors.drugName && (
            <p className="text-sm text-destructive sm:col-span-5">
              {errors.drugName.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

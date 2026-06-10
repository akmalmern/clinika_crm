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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiPatch, apiPost } from '@/lib/api/client';
import type { Service, ServiceCategory } from '@/types/domain';

const NONE = '__none__';

const schema = z.object({
  name: z.string().min(1, 'Nom majburiy').max(200),
  price: z
    .string()
    .min(1, 'Narx majburiy')
    .regex(/^\d+(\.\d{1,2})?$/, 'Narx musbat son (masalan 50000)'),
  categoryId: z.string().optional(),
  duration: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  service?: Service | null;
  categories: ServiceCategory[];
}) {
  const qc = useQueryClient();
  const isEdit = !!service;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', price: '', categoryId: NONE },
  });

  useEffect(() => {
    if (open)
      reset({
        name: service?.name ?? '',
        price: service?.price ?? '',
        categoryId: service?.categoryId ?? NONE,
        duration: service?.duration ? String(service.duration) : '',
      });
  }, [open, service, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string | number> = {
        name: v.name.trim(),
        price: v.price,
      };
      if (v.categoryId && v.categoryId !== NONE) body.categoryId = v.categoryId;
      if (v.duration && v.duration.trim()) body.duration = Number(v.duration);
      return isEdit
        ? apiPatch(`/clinic/services/${service!.id}`, body)
        : apiPost('/clinic/services', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Xizmat yangilandi' : "Xizmat qo'shildi");
      qc.invalidateQueries({ queryKey: ['services'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Xizmatni tahrirlash' : 'Yangi xizmat'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <FormField label="Nomi" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" {...register('name')} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Narx (so'm)"
              htmlFor="price"
              required
              error={errors.price?.message}
              hint={isEdit ? 'O`zgartirilsa narx tarixiga yoziladi' : undefined}
            >
              <Input id="price" inputMode="decimal" {...register('price')} />
            </FormField>
            <FormField label="Davomiyligi (daqiqa)" htmlFor="duration">
              <Input id="duration" type="number" min={1} {...register('duration')} />
            </FormField>
          </div>

          <FormField label="Kategoriya">
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Kategoriyasiz</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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

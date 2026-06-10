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
import type { ServiceCategory } from '@/types/domain';

const schema = z.object({
  name: z.string().min(1, 'Nom majburiy').max(200),
  description: z.string().max(1000).optional(),
});
type Values = z.infer<typeof schema>;

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category?: ServiceCategory | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '' } });

  useEffect(() => {
    if (open)
      reset({
        name: category?.name ?? '',
        description: category?.description ?? '',
      });
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string> = { name: v.name.trim() };
      if (v.description?.trim()) body.description = v.description.trim();
      return isEdit
        ? apiPatch(`/clinic/service-categories/${category!.id}`, body)
        : apiPost('/clinic/service-categories', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Kategoriya yangilandi' : "Kategoriya qo'shildi");
      qc.invalidateQueries({ queryKey: ['service-categories'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <FormField label="Nomi" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" {...register('name')} />
          </FormField>
          <FormField label="Tavsif" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={2} {...register('description')} />
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

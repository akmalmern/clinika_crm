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
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiPatch } from '@/lib/api/client';
import type { ClinicItem } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Nom majburiy').max(200),
  slug: z.string().regex(/^[a-z0-9-]*$/, 'Faqat kichik harf, raqam, tire').optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email noto'g'ri").optional().or(z.literal('')),
});
type Values = z.infer<typeof schema>;

export function ClinicEditDialog({
  open,
  onOpenChange,
  clinic,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinic: ClinicItem;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open)
      reset({
        name: clinic.name,
        slug: clinic.slug,
        address: clinic.address ?? '',
        phone: clinic.phone ?? '',
        email: clinic.email ?? '',
      });
  }, [open, clinic, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, string> = { name: v.name.trim() };
      if (v.slug?.trim()) body.slug = v.slug.trim();
      if (v.address !== undefined) body.address = v.address.trim();
      if (v.phone !== undefined) body.phone = v.phone.trim();
      if (v.email !== undefined && v.email.trim()) body.email = v.email.trim();
      return apiPatch(`/super-admin/clinics/${clinic.id}`, body);
    },
    onSuccess: () => {
      toast.success('Klinika yangilandi');
      qc.invalidateQueries({ queryKey: ['clinic', clinic.id] });
      qc.invalidateQueries({ queryKey: ['clinics'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Klinikani tahrirlash</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <FormField label="Nomi" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" {...register('name')} />
          </FormField>
          <FormField label="Slug" htmlFor="slug" error={errors.slug?.message}>
            <Input id="slug" {...register('slug')} />
          </FormField>
          <FormField label="Telefon" htmlFor="phone">
            <Input id="phone" {...register('phone')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField label="Manzil" htmlFor="address" className="sm:col-span-2">
            <Input id="address" {...register('address')} />
          </FormField>
          <DialogFooter className="gap-2 sm:col-span-2">
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

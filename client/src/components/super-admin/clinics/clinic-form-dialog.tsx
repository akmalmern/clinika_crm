'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { apiErrorMessage, apiGetPage, apiPost } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import type { CreateClinicResult, Plan } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Nom majburiy').max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Faqat kichik harf, raqam va tire')
    .optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email noto'g'ri").optional().or(z.literal('')),
  adminFullName: z.string().min(1, 'Admin F.I.O. majburiy'),
  adminEmail: z.string().min(1, 'Admin email majburiy').email("Email noto'g'ri"),
  adminPhone: z.string().max(30).optional(),
});
type Values = z.infer<typeof schema>;

const NONE = '__default__';

/** Yangi klinika + boshlang'ich CLINIC_ADMIN. Parol berilmaydi -> backend
 *  generatsiya qiladi va `temporaryPassword` qaytaradi (ko'rsatish uchun). */
export function ClinicFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (result: CreateClinicResult) => void;
}) {
  const qc = useQueryClient();
  const [planId, setPlanId] = useState(NONE);
  const [trial, setTrial] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({ name: '', adminFullName: '', adminEmail: '' });
      setPlanId(NONE);
      setTrial(true);
    }
  }, [open, reset]);

  const plans = useQuery({
    queryKey: ['plans-active'],
    queryFn: () => apiGetPage<Plan>('/super-admin/plans?limit=100'),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: Record<string, unknown> = {
        name: v.name.trim(),
        adminFullName: v.adminFullName.trim(),
        adminEmail: v.adminEmail.trim(),
        trial,
      };
      if (v.slug?.trim()) body.slug = v.slug.trim();
      if (v.address?.trim()) body.address = v.address.trim();
      if (v.phone?.trim()) body.phone = v.phone.trim();
      if (v.email?.trim()) body.email = v.email.trim();
      if (v.adminPhone?.trim()) body.adminPhone = v.adminPhone.trim();
      if (planId !== NONE) body.planId = planId;
      return apiPost<CreateClinicResult>('/super-admin/clinics', body);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['clinics'] });
      onOpenChange(false);
      onCreated(result);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const noPlans = plans.data && plans.data.items.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yangi klinika</DialogTitle>
        </DialogHeader>

        {noPlans ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            Avval kamida bitta <b>tarif</b> yarating (Tariflar bo&apos;limi), so&apos;ng
            klinika qo&apos;shing.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit((v) => mutation.mutate(v))}
            className="grid gap-4 sm:grid-cols-2"
          >
            <p className="text-sm font-semibold text-muted-foreground sm:col-span-2">
              Klinika ma&apos;lumotlari
            </p>
            <FormField label="Nomi" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" {...register('name')} />
            </FormField>
            <FormField label="Slug" htmlFor="slug" error={errors.slug?.message} hint="Bo'sh — nomdan yasaladi">
              <Input id="slug" placeholder="demo-klinika" {...register('slug')} />
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

            <p className="mt-2 text-sm font-semibold text-muted-foreground sm:col-span-2">
              Klinika administratori
            </p>
            <FormField
              label="Admin F.I.O."
              htmlFor="adminFullName"
              required
              error={errors.adminFullName?.message}
            >
              <Input id="adminFullName" {...register('adminFullName')} />
            </FormField>
            <FormField
              label="Admin email (login)"
              htmlFor="adminEmail"
              required
              error={errors.adminEmail?.message}
            >
              <Input id="adminEmail" type="email" {...register('adminEmail')} />
            </FormField>
            <FormField label="Admin telefon" htmlFor="adminPhone">
              <Input id="adminPhone" {...register('adminPhone')} />
            </FormField>

            <p className="mt-2 text-sm font-semibold text-muted-foreground sm:col-span-2">
              Obuna
            </p>
            <FormField label="Tarif" hint="Bo'sh — standart tarif">
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Standart tarif</SelectItem>
                  {plans.data?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-center justify-between rounded-md border px-3">
              <div>
                <p className="text-sm font-medium">Sinov muddati (TRIAL)</p>
                <p className="text-xs text-muted-foreground">
                  O&apos;chirilsa — darhol ACTIVE
                </p>
              </div>
              <Switch checked={trial} onCheckedChange={setTrial} />
            </div>

            <DialogFooter className="gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Yaratish
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
import { CLINIC_ROLE_OPTIONS } from '@/lib/constants';
import type { Member } from '@/types/domain';

const baseShape = {
  fullName: z.string().min(1, 'Ism majburiy').max(200),
  phone: z.string().max(30).optional(),
  role: z.string().min(1, 'Rol tanlang'),
  position: z.string().max(200).optional(),
  specialization: z.string().max(200).optional(),
};

const createSchema = z.object({
  ...baseShape,
  email: z.string().min(1, 'Email majburiy').email("Email noto'g'ri"),
  password: z.string().min(8, 'Parol kamida 8 belgi'),
});
const editSchema = z.object(baseShape);

type CreateValues = z.infer<typeof createSchema>;

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member?: Member | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!member;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: { fullName: '', role: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        fullName: member?.fullName ?? '',
        email: '',
        password: '',
        phone: member?.phone ?? '',
        role: member?.role ?? '',
        position: member?.position ?? '',
        specialization: member?.specialization ?? '',
      });
    }
  }, [open, member, reset]);

  const mutation = useMutation({
    mutationFn: (v: CreateValues) => {
      if (isEdit) {
        const body: Record<string, string> = {};
        for (const k of ['fullName', 'phone', 'role', 'position', 'specialization'] as const) {
          const val = v[k];
          if (val && String(val).trim()) body[k] = String(val).trim();
        }
        return apiPatch<Member>(`/clinic/members/${member!.id}`, body);
      }
      const body: Record<string, string> = {
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        password: v.password,
        role: v.role,
      };
      if (v.phone?.trim()) body.phone = v.phone.trim();
      if (v.position?.trim()) body.position = v.position.trim();
      if (v.specialization?.trim()) body.specialization = v.specialization.trim();
      return apiPost<Member>('/clinic/members', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Xodim yangilandi' : "Xodim qo'shildi");
      qc.invalidateQueries({ queryKey: ['members'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['member', member!.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}
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

          {!isEdit && (
            <>
              <FormField
                label="Email"
                htmlFor="email"
                required
                error={errors.email?.message}
              >
                <Input id="email" type="email" {...register('email')} />
              </FormField>
              <FormField
                label="Parol"
                htmlFor="password"
                required
                error={errors.password?.message}
                hint="Kamida 8 belgi"
              >
                <Input id="password" type="password" {...register('password')} />
              </FormField>
            </>
          )}

          <FormField label="Rol" required error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINIC_ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField label="Telefon" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="+998..." {...register('phone')} />
          </FormField>

          <FormField label="Lavozim" htmlFor="position" error={errors.position?.message}>
            <Input id="position" {...register('position')} />
          </FormField>

          <FormField
            label="Mutaxassislik"
            htmlFor="specialization"
            error={errors.specialization?.message}
          >
            <Input id="specialization" {...register('specialization')} />
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

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { homeForRole } from '@/lib/auth/roles';
import { useAuthStore } from '@/store/auth-store';
import type { ApiResponse } from '@/types/api';
import type { AuthProfile } from '@/types/auth';

const loginSchema = z.object({
  email: z.string().min(1, 'Email kiriting').email("Email noto'g'ri formatda"),
  password: z.string().min(8, "Parol kamida 8 belgidan iborat bo'lsin"),
  clinicSlug: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', clinicSlug: '' },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        email: values.email,
        password: values.password,
      };
      if (values.clinicSlug && values.clinicSlug.trim()) {
        payload.clinicSlug = values.clinicSlug.trim();
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ user: AuthProfile }>;

      if (!res.ok || !json.success || !json.data) {
        toast.error(json.message ?? "Kirishda xatolik yuz berdi");
        return;
      }

      const user = json.data.user;
      setUser({
        fullName: user.fullName,
        role: user.role,
        clinicSlug: user.clinicSlug,
      });
      toast.success(`Xush kelibsiz, ${user.fullName}`);

      const next = searchParams.get('next');
      const target =
        next && next.startsWith('/') ? next : homeForRole(user.role);
      router.replace(target);
      router.refresh();
    } catch {
      toast.error("Server bilan bog'lanib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="admin@clinic-crm.uz"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Parol</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="clinicSlug">Klinika identifikatori</Label>
        <Input
          id="clinicSlug"
          type="text"
          autoComplete="off"
          placeholder="masalan: demo-klinika"
          {...register('clinicSlug')}
        />
        <p className="text-xs text-muted-foreground">
          Klinika xodimlari uchun. Super admin bo&apos;sh qoldiradi.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" />}
        Kirish
      </Button>
    </form>
  );
}

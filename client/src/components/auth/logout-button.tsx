'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

/** Qayta ishlatiladigan logout tugmasi (header'siz sahifalar uchun ham). */
export function LogoutButton({
  children = 'Chiqish',
  ...props
}: ButtonProps) {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // baribir mahalliy sessiyani tugatamiz
    } finally {
      clear();
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Button onClick={onClick} disabled={loading} {...props}>
      <LogOut className="h-4 w-4" />
      {children}
    </Button>
  );
}

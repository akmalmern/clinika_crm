'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { roleLabel } from '@/lib/auth/labels';
import { initials } from '@/lib/utils';
import { useAuthStore, type SessionUser } from '@/store/auth-store';

/** Yuqori panel: mobil menyu tugmasi + foydalanuvchi menyusi (logout). */
export function Header({
  user,
  onMenuClick,
}: {
  user: SessionUser;
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // mahalliy sessiyani baribir tugatamiz
    } finally {
      clear();
      toast.success('Tizimdan chiqdingiz');
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Menyu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {roleLabel(user.role)}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-offset-background transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Foydalanuvchi menyusi"
            >
              {initials(user.fullName) || <UserIcon className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate">{user.fullName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {roleLabel(user.role)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              disabled={loggingOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

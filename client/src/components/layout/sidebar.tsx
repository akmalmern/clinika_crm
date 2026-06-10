'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavSection } from '@/lib/auth/navigation';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Yon menyu (rolga qarab bo'limlar). */
export function Sidebar({
  sections,
  panelLabel,
}: {
  sections: NavSection[];
  panelLabel: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-primary-foreground">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Klinika CRM</p>
          <p className="text-xs text-sidebar-foreground/60">{panelLabel}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">
        © {new Date().getFullYear()} Klinika CRM
      </div>
    </div>
  );
}

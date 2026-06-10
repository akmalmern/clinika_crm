import {
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Tags,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Role } from '@/types/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Rolga qarab menyu (spec 12): har rol FAQAT o'ziga ruxsat etilgan bo'limlarni
 * ko'radi. Phase 8A — sahifalar bo'sh skelet, tarkib keyingi fazalarda to'ladi.
 */
const SUPER_ADMIN_NAV: NavSection[] = [
  {
    title: 'Platforma',
    items: [
      { label: 'Boshqaruv paneli', href: '/super-admin/dashboard', icon: LayoutDashboard },
      { label: 'Klinikalar', href: '/super-admin/clinics', icon: Building2 },
      { label: 'Tariflar', href: '/super-admin/plans', icon: Tags },
      { label: "To'lovlar", href: '/super-admin/billing', icon: CreditCard },
      { label: 'Obunalar', href: '/super-admin/subscriptions', icon: CalendarClock },
      { label: 'Statistika', href: '/super-admin/reports', icon: BarChart3 },
    ],
  },
];

const CLINIC_NAV: Record<string, NavSection[]> = {
  [Role.CLINIC_ADMIN]: [
    {
      title: 'Klinika',
      items: [
        { label: 'Boshqaruv paneli', href: '/clinic/dashboard', icon: LayoutDashboard },
        { label: 'Bemorlar', href: '/clinic/patients', icon: Users },
        { label: 'Qabullar', href: '/clinic/appointments', icon: Calendar },
        { label: 'Xizmatlar', href: '/clinic/services', icon: ClipboardList },
        { label: 'Xodimlar', href: '/clinic/staff', icon: UserCog },
        { label: 'Kassa', href: '/clinic/cashier', icon: Wallet },
        { label: 'Tibbiy yozuvlar', href: '/clinic/emr', icon: Stethoscope },
        { label: 'Hisobotlar', href: '/clinic/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'Sozlamalar',
      items: [{ label: 'Sozlamalar', href: '/clinic/settings', icon: Settings }],
    },
  ],
  [Role.DOCTOR]: [
    {
      title: 'Ishchi joy',
      items: [
        { label: 'Boshqaruv paneli', href: '/clinic/dashboard', icon: LayoutDashboard },
        { label: 'Bemorlar', href: '/clinic/patients', icon: Users },
        { label: 'Qabullar', href: '/clinic/appointments', icon: Calendar },
        { label: 'Tibbiy yozuvlar', href: '/clinic/emr', icon: Stethoscope },
      ],
    },
  ],
  [Role.RECEPTIONIST]: [
    {
      title: 'Ishchi joy',
      items: [
        { label: 'Boshqaruv paneli', href: '/clinic/dashboard', icon: LayoutDashboard },
        { label: 'Bemorlar', href: '/clinic/patients', icon: Users },
        { label: 'Qabullar', href: '/clinic/appointments', icon: Calendar },
      ],
    },
  ],
  [Role.NURSE]: [
    {
      title: 'Ishchi joy',
      items: [
        { label: 'Boshqaruv paneli', href: '/clinic/dashboard', icon: LayoutDashboard },
        { label: 'Qabullar', href: '/clinic/appointments', icon: Calendar },
        { label: 'Bemorlar', href: '/clinic/patients', icon: Users },
        { label: 'Tibbiy yozuvlar', href: '/clinic/emr', icon: Stethoscope },
      ],
    },
  ],
  [Role.CASHIER]: [
    {
      title: 'Ishchi joy',
      items: [
        { label: 'Boshqaruv paneli', href: '/clinic/dashboard', icon: LayoutDashboard },
        { label: 'Kassa', href: '/clinic/cashier', icon: Wallet },
        { label: 'Bemorlar', href: '/clinic/patients', icon: Users },
      ],
    },
  ],
};

/** Foydalanuvchi roli uchun navigatsiya bo'limlari. */
export function navForRole(role: string | undefined): NavSection[] {
  if (!role) return [];
  if (role === Role.SUPER_ADMIN) return SUPER_ADMIN_NAV;
  return CLINIC_NAV[role] ?? [];
}

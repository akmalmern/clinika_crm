import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogoutButton } from '@/components/auth/logout-button';
import { serverGetJson } from '@/lib/auth/session';

export const metadata: Metadata = { title: "To'lov talab qilinadi" };

interface SubscriptionInfo {
  status?: string;
  endDate?: string | null;
  nextBillingDate?: string | null;
  graceUntil?: string | null;
}
interface BillingStatus {
  paymentRequired: boolean;
  subscription: SubscriptionInfo | null;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('uz-UZ', {
      dateStyle: 'medium',
      timeZone: 'Asia/Tashkent',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/**
 * SUSPENDED klinika sahifasi (spec 5.3): foydalanuvchi FAQAT shu sahifani ko'radi
 * (layout yon menyuni bermaydi). Backend `/billing/status` (@AllowSuspended)
 * obuna holatini beradi. To'lov klinika admini orqali amalga oshiriladi.
 */
export default async function SuspendedPage() {
  const status = await serverGetJson<BillingStatus>('/billing/status');
  const sub = status?.data?.subscription ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-warning/10 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">Obuna to&apos;xtatilgan</CardTitle>
          <CardDescription>
            Klinikangiz obunasi vaqtincha to&apos;xtatilgan. Tizimdan to&apos;liq
            foydalanishni davom ettirish uchun to&apos;lovni amalga oshiring.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Obuna holati</span>
              <Badge variant="warning">{sub?.status ?? 'Aniqlanmagan'}</Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Tugash sanasi</span>
              <span className="font-medium">{fmtDate(sub?.endDate)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Keyingi to&apos;lov</span>
              <span className="font-medium">
                {fmtDate(sub?.nextBillingDate)}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            To&apos;lov bo&apos;yicha klinika administratori bilan bog&apos;laning
            yoki Payme/Click orqali hisob-fakturani to&apos;lang. To&apos;lov
            tasdiqlangach kirish avtomatik tiklanadi.
          </p>

          <div className="flex justify-end pt-2">
            <LogoutButton variant="outline" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/common/states';
import { apiGet } from '@/lib/api/client';
import { SUBSCRIPTION_STATUS_LABEL } from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import type { PlatformSubscriptions } from '@/types/admin';

const DAY_OPTS = [7, 14, 30, 60, 90];

export function SubscriptionsClient() {
  const router = useRouter();
  const [days, setDays] = useState('30');

  const query = useQuery({
    queryKey: ['platform', 'subscriptions', days],
    queryFn: () =>
      apiGet<PlatformSubscriptions>(
        `/super-admin/reports/subscriptions?days=${days}`,
      ),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState onRetry={() => query.refetch()} />;

  const s = query.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Obunalar nazorati"
        description="Faol, yaqinda tugaydigan va qarzdor klinikalar."
      >
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_OPTS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                Keyingi {d} kun
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Faol obunalar"
          value={String(s.active)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Yaqinda tugaydi"
          value={String(s.expiringSoon.count)}
          icon={CalendarClock}
          tone="warning"
        />
        <KpiCard
          label="Qarzdor klinikalar"
          value={String(s.debtors.count)}
          icon={AlertTriangle}
          tone="danger"
          sub={formatMoney(s.debtors.totalDebt)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {s.byStatus.map((st) => (
          <Badge key={st.status} variant="outline" className="gap-1.5">
            {SUBSCRIPTION_STATUS_LABEL[st.status] ?? st.status}
            <span className="font-semibold">{st.count}</span>
          </Badge>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Yaqinda tugaydigan obunalar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s.expiringSoon.items.length === 0 ? (
              <EmptyState title="Yo'q" description="Bu davrda tugaydigan obuna yo'q." />
            ) : (
              <ul className="divide-y">
                {s.expiringSoon.items.map((it) => (
                  <li key={it.clinicId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/super-admin/clinics/${it.clinicId}`)}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{it.clinicName ?? '—'}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {it.nextBillingDate ? formatDate(it.nextBillingDate) : '—'}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qarzdor klinikalar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s.debtors.items.length === 0 ? (
              <EmptyState title="Yo'q" description="Qarzdor klinika yo'q." />
            ) : (
              <ul className="divide-y">
                {s.debtors.items.map((it) => (
                  <li key={it.clinicId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/super-admin/clinics/${it.clinicId}`)}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{it.clinicName ?? '—'}</span>
                      <span className="flex items-center gap-2 font-medium text-destructive">
                        {formatMoney(it.totalDebt)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-accent text-accent-foreground';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

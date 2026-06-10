'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState, LoadingState } from '@/components/common/states';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { CategoryPie } from '@/components/charts/category-pie';
import { apiGet } from '@/lib/api/client';
import {
  CLINIC_STATUS_LABEL,
  PROVIDER_LABEL,
} from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import type {
  PlatformOverview,
  PlatformRevenue,
  PlatformSubscriptions,
} from '@/types/admin';

function monthsAgoIso(n: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString();
}

function monthLabel(period: string): string {
  const d = new Date(period);
  return new Intl.DateTimeFormat('uz-UZ', {
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

export function DashboardClient() {
  const overview = useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: () => apiGet<PlatformOverview>('/super-admin/reports/overview'),
  });
  const revenue = useQuery({
    queryKey: ['platform', 'revenue', 'dashboard'],
    queryFn: () =>
      apiGet<PlatformRevenue>(
        `/super-admin/reports/revenue?from=${monthsAgoIso(5)}&to=${new Date().toISOString()}&groupBy=month`,
      ),
  });
  const subs = useQuery({
    queryKey: ['platform', 'subscriptions', '30'],
    queryFn: () =>
      apiGet<PlatformSubscriptions>('/super-admin/reports/subscriptions?days=30'),
  });

  const statusCount = useMemo(() => {
    const map = new Map(
      overview.data?.clinics.byStatus.map((s) => [s.status, s.count]),
    );
    return (s: string) => map.get(s) ?? 0;
  }, [overview.data]);

  const revenuePoints = useMemo(
    () =>
      (revenue.data?.byPeriod ?? []).map((p) => ({
        label: monthLabel(p.period),
        value: Number(p.total),
      })),
    [revenue.data],
  );
  const statusPie = useMemo(
    () =>
      (overview.data?.clinics.byStatus ?? []).map((s) => ({
        name: CLINIC_STATUS_LABEL[s.status] ?? s.status,
        value: s.count,
      })),
    [overview.data],
  );
  const providerPie = useMemo(
    () =>
      (revenue.data?.byProvider ?? []).map((p) => ({
        name: PROVIDER_LABEL[p.provider] ?? p.provider,
        value: Number(p.total),
      })),
    [revenue.data],
  );

  if (overview.isLoading || revenue.isLoading || subs.isLoading)
    return <LoadingState />;
  if (overview.isError || !overview.data)
    return <ErrorState onRetry={() => overview.refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Boshqaruv paneli"
        description="Platforma bo'yicha asosiy ko'rsatkichlar."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Jami klinikalar"
          value={String(overview.data.clinics.total)}
          icon={Building2}
          sub={`Faol ${statusCount('ACTIVE')} · Sinov ${statusCount('TRIAL')} · To'xt. ${statusCount('SUSPENDED')}`}
        />
        <Kpi
          label="Faol obunalar"
          value={String(overview.data.subscriptions.active)}
          icon={TrendingUp}
          tone="success"
        />
        <Kpi
          label="Platforma daromadi (oxirgi davr)"
          value={formatMoney(revenue.data?.totals.total)}
          icon={CreditCard}
        />
        <Kpi
          label="Qarzdor klinikalar"
          value={String(subs.data?.debtors.count ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          sub={formatMoney(subs.data?.debtors.totalDebt)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daromad dinamikasi (oylar)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={revenuePoints} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Klinikalar holati</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPie data={statusPie} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">To&apos;lov usuli kesimi</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPie data={providerPie} valueFormatter={(v) => formatMoney(v)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
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
  tone?: 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'danger'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-accent text-accent-foreground';
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold">{value}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

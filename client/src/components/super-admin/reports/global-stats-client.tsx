'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { apiGet } from '@/lib/api/client';
import { formatMoney, toLocalDateValue, addDays } from '@/lib/format';
import type { PlatformRevenue, TopClinicsReport, TopClinicRow } from '@/types/admin';

function monthLabel(period: string): string {
  const d = new Date(period);
  return new Intl.DateTimeFormat('uz-UZ', { month: 'short', timeZone: 'UTC' }).format(d);
}

export function GlobalStatsClient() {
  const today = toLocalDateValue(new Date());
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);

  const rangeQs = `from=${from}&to=${to}`;

  const revenue = useQuery({
    queryKey: ['platform', 'revenue', from, to],
    queryFn: () =>
      apiGet<PlatformRevenue>(
        `/super-admin/reports/revenue?${rangeQs}&groupBy=month`,
      ),
  });
  const top = useQuery({
    queryKey: ['platform', 'top-clinics', from, to],
    queryFn: () =>
      apiGet<TopClinicsReport>(
        `/super-admin/reports/top-clinics?${rangeQs}&limit=50`,
      ),
  });

  const revenuePoints = useMemo(
    () =>
      (revenue.data?.byPeriod ?? []).map((p) => ({
        label: monthLabel(p.period),
        value: Number(p.total),
      })),
    [revenue.data],
  );

  const totals = useMemo(() => {
    const rows = top.data?.rows ?? [];
    return {
      patients: rows.reduce((a, r) => a + r.patients, 0),
      appointments: rows.reduce((a, r) => a + r.appointments, 0),
    };
  }, [top.data]);

  const columns: Column<TopClinicRow & { id: string }>[] = [
    {
      key: 'name',
      header: 'Klinika',
      cell: (r) => <span className="font-medium">{r.clinicName ?? '—'}</span>,
    },
    { key: 'patients', header: 'Bemorlar', cell: (r) => r.patients },
    { key: 'appointments', header: 'Qabullar', cell: (r) => r.appointments },
  ];
  const rows = (top.data?.rows ?? []).map((r) => ({ ...r, id: r.clinicId }));

  function exportUrl(report: 'revenue' | 'top-clinics', format: 'csv' | 'pdf') {
    const extra = report === 'revenue' ? '&groupBy=month' : '&limit=50';
    return `/api/backend/super-admin/reports/${report}/export?${rangeQs}${extra}&format=${format}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Global statistika"
        description="Platforma daromadi va eng faol klinikalar."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Dan</p>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Gacha</p>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniKpi label="Daromad (davr)" value={formatMoney(revenue.data?.totals.total)} />
        <MiniKpi label="Jami bemorlar (top 50)" value={String(totals.patients)} />
        <MiniKpi label="Jami qabullar (top 50)" value={String(totals.appointments)} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Platforma daromadi</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl('revenue', 'csv')} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl('revenue', 'pdf')} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart data={revenuePoints} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Eng faol klinikalar</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl('top-clinics', 'csv')} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl('top-clinics', 'pdf')} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            loading={top.isLoading}
            error={top.isError}
            onRetry={() => top.refetch()}
            empty={
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-6 w-6" />
                Ma&apos;lumot yo&apos;q
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

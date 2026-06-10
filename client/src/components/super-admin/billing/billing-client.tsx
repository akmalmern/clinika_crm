'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { StatusBadge } from '@/components/common/status-badge';
import { apiGet, apiGetPage } from '@/lib/api/client';
import {
  ADMIN_INVOICE_STATUS_LABEL,
  ADMIN_INVOICE_STATUS_VARIANT,
  PROVIDER_LABEL,
} from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import type { AdminInvoice, ClinicItem } from '@/types/admin';
import { ManualPaymentDialog } from './manual-payment-dialog';

interface PaymentStats {
  rows: { provider: string; method: string | null; count: number; totalAmount: string }[];
  totals: { count: number; totalAmount: string };
}

const STATUS_OPTS = ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];

export function BillingClient() {
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pay, setPay] = useState<AdminInvoice | null>(null);

  const clinicsQuery = useQuery({
    queryKey: ['clinics-map'],
    queryFn: () => apiGetPage<ClinicItem>('/super-admin/clinics?limit=100'),
    staleTime: 60_000,
  });
  const clinicName = useMemo(() => {
    const map = new Map(clinicsQuery.data?.items.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [clinicsQuery.data]);

  const stats = useQuery({
    queryKey: ['payment-stats'],
    queryFn: () => apiGet<PaymentStats>('/super-admin/payments/stats'),
  });

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status !== 'ALL') params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const invoices = useQuery({
    queryKey: ['admin-invoices', { status, from, to, page }],
    queryFn: () =>
      apiGetPage<AdminInvoice>(`/super-admin/invoices?${params.toString()}`),
  });

  const providerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of stats.data?.rows ?? []) {
      map.set(r.provider, (map.get(r.provider) ?? 0) + Number(r.totalAmount));
    }
    return Array.from(map.entries());
  }, [stats.data]);

  const columns: Column<AdminInvoice>[] = [
    {
      key: 'number',
      header: 'Raqam',
      cell: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span>,
    },
    { key: 'clinic', header: 'Klinika', cell: (i) => clinicName(i.clinicId) },
    { key: 'total', header: 'Jami', cell: (i) => formatMoney(i.totalAmount) },
    {
      key: 'debt',
      header: 'Qarz',
      cell: (i) => (
        <span className={Number(i.debtAmount) > 0 ? 'font-medium text-destructive' : ''}>
          {formatMoney(i.debtAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      cell: (i) => (
        <StatusBadge
          value={i.status}
          labels={ADMIN_INVOICE_STATUS_LABEL}
          variants={ADMIN_INVOICE_STATUS_VARIANT}
        />
      ),
    },
    { key: 'date', header: 'Sana', cell: (i) => formatDate(i.createdAt) },
    {
      key: 'action',
      header: '',
      className: 'w-44 text-right',
      cell: (i) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="PDF">
            <a
              href={`/api/backend/super-admin/invoices/${i.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4" />
            </a>
          </Button>
          {Number(i.debtAmount) > 0 && i.status !== 'CANCELLED' && (
            <Button variant="outline" size="sm" onClick={() => setPay(i)}>
              <Wallet className="h-4 w-4" />
              To&apos;lov
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="To'lovlar"
        description="Abonent hisob-fakturalari va tranzaksiyalar."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Jami qabul qilingan"
          value={formatMoney(stats.data?.totals.totalAmount)}
          icon={CreditCard}
        />
        {providerTotals.map(([provider, total]) => (
          <StatCard
            key={provider}
            label={PROVIDER_LABEL[provider] ?? provider}
            value={formatMoney(total)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Holat</p>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Barcha holat</SelectItem>
              {STATUS_OPTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ADMIN_INVOICE_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Dan</p>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Gacha</p>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={invoices.data?.items ?? []}
          loading={invoices.isLoading}
          error={invoices.isError}
          onRetry={() => invoices.refetch()}
        />
        {invoices.data && invoices.data.items.length > 0 && (
          <Pagination meta={invoices.data.meta} onPageChange={setPage} />
        )}
      </Card>

      <ManualPaymentDialog
        invoice={pay}
        open={!!pay}
        onOpenChange={(o) => !o && setPay(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

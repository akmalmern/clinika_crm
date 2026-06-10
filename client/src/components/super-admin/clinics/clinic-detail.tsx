'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Pencil, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable, type Column } from '@/components/common/data-table';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { apiErrorMessage, apiGetPage, apiPost } from '@/lib/api/client';
import { apiGet } from '@/lib/api/client';
import {
  ADMIN_INVOICE_STATUS_LABEL,
  ADMIN_INVOICE_STATUS_VARIANT,
  BILLING_CYCLE_LABEL,
  CLINIC_STATUS_LABEL,
  CLINIC_STATUS_VARIANT,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_VARIANT,
} from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import type { AdminInvoice, ClinicItem } from '@/types/admin';
import { ClinicEditDialog } from './clinic-edit-dialog';
import { ManualPaymentDialog } from '@/components/super-admin/billing/manual-payment-dialog';

export function ClinicDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'suspend' | 'reactivate'>(null);
  const [payInvoice, setPayInvoice] = useState<AdminInvoice | null>(null);

  const query = useQuery({
    queryKey: ['clinic', id],
    queryFn: () => apiGet<ClinicItem>(`/super-admin/clinics/${id}`),
  });

  const invoices = useQuery({
    queryKey: ['admin-invoices', { clinicId: id }],
    queryFn: () =>
      apiGetPage<AdminInvoice>(
        `/super-admin/invoices?clinicId=${id}&page=1&limit=20`,
      ),
  });

  const action = useMutation({
    mutationFn: (kind: 'suspend' | 'reactivate') =>
      apiPost(`/super-admin/clinics/${id}/${kind}`),
    onSuccess: (_d, kind) => {
      toast.success(kind === 'suspend' ? "Klinika to'xtatildi" : 'Faollashtirildi');
      qc.invalidateQueries({ queryKey: ['clinic', id] });
      qc.invalidateQueries({ queryKey: ['clinics'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState onRetry={() => query.refetch()} />;

  const c = query.data;
  const sub = c.subscription;
  const suspended = c.status === 'SUSPENDED';

  const info: { label: string; value: string }[] = [
    { label: 'Slug', value: c.slug },
    { label: 'Telefon', value: c.phone ?? '—' },
    { label: 'Email', value: c.email ?? '—' },
    { label: 'Manzil', value: c.address ?? '—' },
    { label: "A'zolar soni", value: String(c.membersCount) },
    { label: 'Yaratilgan', value: formatDate(c.createdAt) },
  ];

  const invoiceColumns: Column<AdminInvoice>[] = [
    {
      key: 'number',
      header: 'Raqam',
      cell: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span>,
    },
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
      className: 'w-28 text-right',
      cell: (i) =>
        Number(i.debtAmount) > 0 && i.status !== 'CANCELLED' ? (
          <Button variant="outline" size="sm" onClick={() => setPayInvoice(i)}>
            <Wallet className="h-4 w-4" />
            To&apos;lov
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
              <StatusBadge
                value={c.status}
                labels={CLINIC_STATUS_LABEL}
                variants={CLINIC_STATUS_VARIANT}
              />
            </div>
            <p className="text-sm text-muted-foreground">Klinika tafsiloti</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Tahrirlash
          </Button>
          {suspended ? (
            <Button onClick={() => setConfirm('reactivate')}>
              <CheckCircle2 className="h-4 w-4" />
              Faollashtirish
            </Button>
          ) : (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setConfirm('suspend')}
            >
              <Ban className="h-4 w-4" />
              To&apos;xtatish
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ma&apos;lumot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4">
            {info.map((row) => (
              <div key={row.label}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-0.5 text-sm">{row.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obuna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sub ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{sub.plan?.name ?? 'Tarif yo`q'}</p>
                    {sub.plan && (
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(sub.plan.price)} ·{' '}
                        {BILLING_CYCLE_LABEL[sub.plan.billingCycle] ??
                          sub.plan.billingCycle}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    value={sub.status}
                    labels={SUBSCRIPTION_STATUS_LABEL}
                    variants={SUBSCRIPTION_STATUS_VARIANT}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Field label="Boshlangan" value={formatDate(sub.startDate)} />
                  <Field
                    label="Keyingi to'lov"
                    value={sub.nextBillingDate ? formatDate(sub.nextBillingDate) : '—'}
                  />
                  <Field
                    label="Tugash"
                    value={sub.endDate ? formatDate(sub.endDate) : '—'}
                  />
                  <Field
                    label="Grace"
                    value={sub.graceUntil ? formatDate(sub.graceUntil) : '—'}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Obuna topilmadi.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">To&apos;lov tarixi (hisob-fakturalar)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={invoiceColumns}
            data={invoices.data?.items ?? []}
            loading={invoices.isLoading}
            error={invoices.isError}
            onRetry={() => invoices.refetch()}
          />
        </CardContent>
      </Card>

      <ClinicEditDialog open={editOpen} onOpenChange={setEditOpen} clinic={c} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'suspend' ? "Klinikani to'xtatish" : 'Faollashtirish'}
        description={
          confirm === 'suspend'
            ? `${c.name} SUSPENDED holatiga o'tadi — foydalanuvchilar faqat to'lov sahifasini ko'radi.`
            : `${c.name} qayta faollashtiriladi.`
        }
        destructive={confirm === 'suspend'}
        confirmText={confirm === 'suspend' ? "Ha, to'xtatish" : 'Faollashtirish'}
        onConfirm={() => action.mutateAsync(confirm!)}
      />
      <ManualPaymentDialog
        invoice={payInvoice}
        open={!!payInvoice}
        onOpenChange={(o) => !o && setPayInvoice(null)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

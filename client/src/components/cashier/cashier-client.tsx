'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { EmptyState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { PatientCombobox } from '@/components/appointments/patient-combobox';
import { useCan } from '@/components/session-provider';
import { Permission } from '@/lib/auth/permissions';
import { apiGetPage } from '@/lib/api/client';
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
} from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import type { Patient, PatientInvoice } from '@/types/domain';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { PaymentDialog } from './payment-dialog';

export function CashierClient() {
  const can = useCan();
  const canPay = can(Permission.PATIENT_PAYMENT);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (patient) params.set('patientId', patient.id);
  if (status !== 'ALL') params.set('status', status);

  const query = useQuery({
    queryKey: ['patient-invoices', patient?.id ?? 'all', { status, page }],
    queryFn: () =>
      apiGetPage<PatientInvoice>(
        `/clinic/patient-invoices?${params.toString()}`,
      ),
  });

  const columns: Column<PatientInvoice>[] = [
    { key: 'total', header: 'Jami', cell: (i) => formatMoney(i.totalAmount) },
    {
      key: 'paid',
      header: "To'langan",
      cell: (i) => formatMoney(i.paidAmount),
    },
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
          labels={INVOICE_STATUS_LABEL}
          variants={INVOICE_STATUS_VARIANT}
        />
      ),
    },
    { key: 'date', header: 'Sana', cell: (i) => formatDate(i.createdAt) },
    {
      key: 'action',
      header: '',
      className: 'w-28 text-right',
      cell: (i) => (
        <Button variant="outline" size="sm" onClick={() => setPayInvoice(i.id)}>
          <Wallet className="h-4 w-4" />
          Ochish
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kassa"
        description="Bemor hisob-fakturalari va to'lovlar."
      >
        {canPay && patient && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Yangi hisob
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 sm:w-80">
          <div className="flex-1">
            <PatientCombobox
              value={patient?.id}
              label={patient?.fullName}
              onSelect={(p) => {
                setPatient(p);
                setPage(1);
              }}
            />
          </div>
          {patient && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPatient(null);
                setPage(1);
              }}
              aria-label="Tozalash"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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
            {Object.keys(INVOICE_STATUS_LABEL).map((s) => (
              <SelectItem key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          empty={
            <EmptyState
              title="Hisob-faktura yo'q"
              description={
                patient
                  ? "Ushbu bemor uchun hisob qo'shing."
                  : 'Bemorni tanlang yoki filtrlardan foydalaning.'
              }
              icon={Wallet}
            />
          }
        />
        {query.data && query.data.items.length > 0 && (
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        )}
      </Card>

      {patient && (
        <InvoiceFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          patientId={patient.id}
        />
      )}
      <PaymentDialog
        invoiceId={payInvoice}
        patientId={patient?.id ?? 'all'}
        open={!!payInvoice}
        onOpenChange={(o) => !o && setPayInvoice(null)}
        canPay={canPay}
      />
    </div>
  );
}

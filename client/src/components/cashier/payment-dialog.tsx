'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { StatusBadge } from '@/components/common/status-badge';
import { LoadingState } from '@/components/common/states';
import { apiErrorMessage, apiGet, apiPost } from '@/lib/api/client';
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from '@/lib/constants';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { PatientInvoiceDetail } from '@/types/domain';

export function PaymentDialog({
  invoiceId,
  patientId,
  open,
  onOpenChange,
  canPay,
}: {
  invoiceId: string | null;
  patientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canPay: boolean;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);

  const query = useQuery({
    queryKey: ['patient-invoice', invoiceId],
    queryFn: () =>
      apiGet<PatientInvoiceDetail>(`/clinic/patient-invoices/${invoiceId}`),
    enabled: open && !!invoiceId,
  });

  const invoice = query.data;

  useEffect(() => {
    if (invoice) setAmount(invoice.debtAmount);
  }, [invoice]);

  const pay = useMutation({
    mutationFn: () =>
      apiPost(`/clinic/patient-invoices/${invoiceId}/payments`, {
        amount,
        method,
      }),
    onSuccess: () => {
      toast.success("To'lov qabul qilindi");
      qc.invalidateQueries({ queryKey: ['patient-invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['patient-invoices', patientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const fullyPaid = invoice ? Number(invoice.debtAmount) <= 0 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Hisob-faktura va to&apos;lov</DialogTitle>
        </DialogHeader>

        {query.isLoading || !invoice ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-center">
              <Summary label="Jami" value={formatMoney(invoice.totalAmount)} />
              <Summary
                label="To'langan"
                value={formatMoney(invoice.paidAmount)}
                tone="success"
              />
              <Summary
                label="Qarz"
                value={formatMoney(invoice.debtAmount)}
                tone={Number(invoice.debtAmount) > 0 ? 'danger' : undefined}
              />
            </div>

            <div className="flex items-center justify-between">
              <StatusBadge
                value={invoice.status}
                labels={INVOICE_STATUS_LABEL}
                variants={INVOICE_STATUS_VARIANT}
              />
              <span className="text-xs text-muted-foreground">
                {formatDateTime(invoice.createdAt)}
              </span>
            </div>

            {canPay && !fullyPaid && invoice.status !== 'CANCELLED' && (
              <div className="grid items-end gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_140px_auto]">
                <FormField label="To'lov summasi">
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </FormField>
                <FormField label="Usul">
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                  {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  To&apos;lash
                </Button>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                To&apos;lovlar tarixi
              </p>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Hali to&apos;lov yo&apos;q.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {invoice.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 p-2.5 text-sm"
                    >
                      <span className="font-medium">{formatMoney(p.amount)}</span>
                      <span className="text-muted-foreground">
                        {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                      </span>
                      <span className="flex-1 text-right text-xs text-muted-foreground">
                        {formatDateTime(p.paidAt)}
                      </span>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Chek"
                      >
                        <a
                          href={`/api/backend/clinic/payments/${p.id}/receipt`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Receipt className="h-4 w-4" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'success'
            ? 'font-semibold text-success'
            : tone === 'danger'
              ? 'font-semibold text-destructive'
              : 'font-semibold'
        }
      >
        {value}
      </p>
    </div>
  );
}

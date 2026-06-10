'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { apiErrorMessage, apiPost } from '@/lib/api/client';
import {
  MANUAL_METHOD_LABEL,
  MANUAL_METHODS,
} from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import type { AdminInvoice } from '@/types/admin';

/** Qo'lda (naqd/bank) to'lov — invoice uzayadi/yopiladi (spec 5.4 MANUAL). */
export function ManualPaymentDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: AdminInvoice | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(MANUAL_METHODS[0]);
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setAmount(invoice.debtAmount);
      setMethod(MANUAL_METHODS[0]);
      setReference('');
    }
  }, [open, invoice]);

  const pay = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {
        invoiceId: invoice!.id,
        amount,
        method,
      };
      if (reference.trim()) body.reference = reference.trim();
      return apiPost('/super-admin/payments/manual', body);
    },
    onSuccess: () => {
      toast.success("To'lov qayd etildi");
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      qc.invalidateQueries({ queryKey: ['clinic'] });
      qc.invalidateQueries({ queryKey: ['platform'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Qo&apos;lda to&apos;lov</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hisob-faktura</span>
                <span className="font-mono">{invoice.invoiceNumber}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Qarz</span>
                <span className="font-medium text-destructive">
                  {formatMoney(invoice.debtAmount)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Summa">
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
                    {MANUAL_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MANUAL_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Reference / izoh">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="To'lov hujjati raqami"
              />
            </FormField>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Tasdiqlash
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { apiDelete, apiErrorMessage, apiGetPage } from '@/lib/api/client';
import { BILLING_CYCLE_LABEL } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import type { Plan } from '@/types/admin';
import { PlanFormDialog } from './plan-form-dialog';

export function PlansClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [del, setDel] = useState<Plan | null>(null);

  const query = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiGetPage<Plan>('/super-admin/plans?limit=100'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/super-admin/plans/${id}`),
    onSuccess: () => {
      toast.success("Tarif o'chirildi");
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Tariflar" description="Obuna tariflari, limit va imkoniyatlar.">
        <Button
          onClick={() => {
            setEdit(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi tarif
        </Button>
      </PageHeader>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          title="Tarif yo'q"
          description="Klinika qo'shishdan oldin kamida bitta tarif yarating."
          icon={Tags}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Tarif qo&apos;shish
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <Badge variant={p.isActive ? 'success' : 'secondary'}>
                    {p.isActive ? 'Faol' : 'Nofaol'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">
                  {formatMoney(p.price)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {BILLING_CYCLE_LABEL[p.billingCycle] ?? p.billingCycle}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <ul className="space-y-1.5 text-sm">
                  <Limit label="Xodimlar" value={p.limits?.maxStaff} />
                  <Limit label="Bemorlar" value={p.limits?.maxPatients} />
                  <Limit label="Xotira" value={p.limits?.storageGb} suffix=" GB" />
                  <Limit label="SMS" value={p.limits?.smsCount} />
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  <Feature label="Dorixona" on={!!p.features?.pharmacy} />
                  <Feature label="Telegram" on={!!p.features?.telegram} />
                </div>
                <div className="mt-auto flex justify-end gap-1 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEdit(p);
                      setFormOpen(true);
                    }}
                    aria-label="Tahrirlash"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDel(p)}
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEdit(null);
        }}
        plan={edit}
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Tarifni o'chirish"
        description={del?.name}
        onConfirm={() => del && remove.mutateAsync(del.id)}
      />
    </div>
  );
}

function Limit({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value?: number;
  suffix?: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value !== undefined && value !== null ? `${value}${suffix}` : '∞'}
      </span>
    </li>
  );
}

function Feature({ label, on }: { label: string; on: boolean }) {
  return (
    <Badge variant={on ? 'default' : 'outline'} className="gap-1">
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

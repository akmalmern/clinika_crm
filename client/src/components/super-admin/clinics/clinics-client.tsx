'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
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
import { SearchInput } from '@/components/common/search-input';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { EmptyState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { apiGetPage } from '@/lib/api/client';
import {
  CLINIC_STATUS_LABEL,
  CLINIC_STATUS_VARIANT,
  CLINIC_STATUSES,
} from '@/lib/constants';
import { formatDate } from '@/lib/format';
import type { ClinicItem, CreateClinicResult } from '@/types/admin';
import { ClinicFormDialog } from './clinic-form-dialog';
import { CredentialsDialog } from './credentials-dialog';

export function ClinicsClient() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreateClinicResult | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  if (status !== 'ALL') params.set('status', status);

  const query = useQuery({
    queryKey: ['clinics', { search, status, page }],
    queryFn: () =>
      apiGetPage<ClinicItem>(`/super-admin/clinics?${params.toString()}`),
  });

  const columns: Column<ClinicItem>[] = [
    {
      key: 'name',
      header: 'Klinika',
      cell: (c) => (
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      cell: (c) => (
        <StatusBadge
          value={c.status}
          labels={CLINIC_STATUS_LABEL}
          variants={CLINIC_STATUS_VARIANT}
        />
      ),
    },
    {
      key: 'plan',
      header: 'Tarif',
      cell: (c) => c.subscription?.plan?.name ?? '—',
    },
    { key: 'members', header: "A'zolar", cell: (c) => c.membersCount },
    {
      key: 'nextBilling',
      header: 'Keyingi to`lov',
      cell: (c) =>
        c.subscription?.nextBillingDate
          ? formatDate(c.subscription.nextBillingDate)
          : '—',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Klinikalar"
        description="Barcha klinikalar, obunalar va holatlar."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Yangi klinika
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Klinika nomi bo'yicha..."
          className="sm:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Barcha holat</SelectItem>
            {CLINIC_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CLINIC_STATUS_LABEL[s]}
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
          onRowClick={(c) => router.push(`/super-admin/clinics/${c.id}`)}
          empty={
            <EmptyState
              title="Klinika topilmadi"
              icon={Building2}
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Klinika qo&apos;shish
                </Button>
              }
            />
          }
        />
        {query.data && query.data.items.length > 0 && (
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        )}
      </Card>

      <ClinicFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(r) => setCreated(r)}
      />
      <CredentialsDialog
        result={created}
        open={!!created}
        onOpenChange={(o) => !o && setCreated(null)}
      />
    </div>
  );
}

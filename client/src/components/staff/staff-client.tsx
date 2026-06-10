'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { apiGetPage } from '@/lib/api/client';
import { CLINIC_ROLE_OPTIONS } from '@/lib/constants';
import { roleLabel } from '@/lib/auth/labels';
import type { Member } from '@/types/domain';
import { MemberFormDialog } from './member-form-dialog';

export function StaffClient() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  if (role !== 'ALL') params.set('role', role);

  const query = useQuery({
    queryKey: ['members', { search, role, page }],
    queryFn: () => apiGetPage<Member>(`/clinic/members?${params.toString()}`),
  });

  const columns: Column<Member>[] = [
    {
      key: 'fullName',
      header: 'F.I.O.',
      cell: (m) => <span className="font-medium">{m.fullName}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      cell: (m) => <Badge variant="secondary">{roleLabel(m.role)}</Badge>,
    },
    { key: 'email', header: 'Email', cell: (m) => m.email ?? '—' },
    { key: 'phone', header: 'Telefon', cell: (m) => m.phone ?? '—' },
    {
      key: 'isActive',
      header: 'Holat',
      cell: (m) => (
        <Badge variant={m.isActive ? 'success' : 'secondary'}>
          {m.isActive ? 'Faol' : 'Nofaol'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Xodimlar"
        description="Klinika xodimlari, rollar va hujjatlar."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Yangi xodim
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Ism, email yoki telefon..."
          className="sm:max-w-sm"
        />
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Barcha rollar</SelectItem>
            {CLINIC_ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
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
          onRowClick={(m) => router.push(`/clinic/staff/${m.id}`)}
          empty={
            <EmptyState
              title="Xodim topilmadi"
              icon={UserCog}
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Xodim qo&apos;shish
                </Button>
              }
            />
          }
        />
        {query.data && query.data.items.length > 0 && (
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        )}
      </Card>

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

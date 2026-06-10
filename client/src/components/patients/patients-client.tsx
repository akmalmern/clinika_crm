'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserPlus } from 'lucide-react';
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
import { useCan } from '@/components/session-provider';
import { Permission } from '@/lib/auth/permissions';
import { apiGetPage } from '@/lib/api/client';
import { GENDER_LABEL, GENDERS } from '@/lib/constants';
import { ageFromBirthDate, formatDate } from '@/lib/format';
import type { Patient } from '@/types/domain';
import { PatientFormDialog } from './patient-form-dialog';

export function PatientsClient() {
  const router = useRouter();
  const can = useCan();
  const canManage = can(Permission.PATIENT_MANAGE);

  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  if (gender !== 'ALL') params.set('gender', gender);

  const query = useQuery({
    queryKey: ['patients', { search, gender, page }],
    queryFn: () => apiGetPage<Patient>(`/clinic/patients?${params.toString()}`),
  });

  const columns: Column<Patient>[] = [
    {
      key: 'fullName',
      header: 'F.I.O.',
      cell: (p) => <span className="font-medium">{p.fullName}</span>,
    },
    { key: 'phone', header: 'Telefon', cell: (p) => p.phone ?? '—' },
    {
      key: 'gender',
      header: 'Jins',
      cell: (p) => (p.gender ? GENDER_LABEL[p.gender] ?? p.gender : '—'),
    },
    {
      key: 'birthDate',
      header: "Tug'ilgan / yosh",
      cell: (p) => {
        const age = ageFromBirthDate(p.birthDate);
        return p.birthDate
          ? `${formatDate(p.birthDate)}${age !== null ? ` (${age})` : ''}`
          : '—';
      },
    },
    {
      key: 'createdAt',
      header: "Qo'shilgan",
      cell: (p) => formatDate(p.createdAt),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bemorlar"
        description="Bemorlar bazasi, qidiruv va profillar."
      >
        {canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Yangi bemor
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Ism yoki telefon bo'yicha qidirish..."
          className="sm:max-w-sm"
        />
        <Select
          value={gender}
          onValueChange={(v) => {
            setGender(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Barcha jins</SelectItem>
            {GENDERS.map((g) => (
              <SelectItem key={g} value={g}>
                {GENDER_LABEL[g]}
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
          onRowClick={(p) => router.push(`/clinic/patients/${p.id}`)}
          empty={
            <EmptyState
              title="Bemor topilmadi"
              description={
                search || gender !== 'ALL'
                  ? "Filtrlarni o'zgartirib ko'ring."
                  : "Birinchi bemorni qo'shing."
              }
              icon={UserPlus}
              action={
                canManage && !search && gender === 'ALL' ? (
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Bemor qo&apos;shish
                  </Button>
                ) : undefined
              }
            />
          }
        />
        {query.data && query.data.items.length > 0 && (
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        )}
      </Card>

      <PatientFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

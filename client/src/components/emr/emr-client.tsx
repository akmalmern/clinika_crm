'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Stethoscope, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { EmptyState, LoadingState } from '@/components/common/states';
import { PatientHistory } from './patient-history';
import { apiGetPage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import type { Patient } from '@/types/domain';

/** Tibbiy yozuvlar: bemorni qidirib tanlash -> uning kasallik tarixi. */
export function EmrClient() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

  const query = useQuery({
    queryKey: ['patients', { search, page: 1, emr: true }],
    queryFn: () =>
      apiGetPage<Patient>(
        `/clinic/patients?page=1&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: !selected,
  });

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelected(null)}
            aria-label="Orqaga"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selected.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selected.phone ?? 'Tibbiy yozuvlar'}
            </p>
          </div>
        </div>
        <PatientHistory patientId={selected.id} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tibbiy yozuvlar"
        description="Bemorni tanlang va kasallik tarixini ko'ring."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Bemorni ism yoki telefon bo'yicha qidirish..."
        className="sm:max-w-md"
      />

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <LoadingState />
          ) : !query.data?.items.length ? (
            <EmptyState
              title="Bemor topilmadi"
              description="Qidiruvni o'zgartirib ko'ring."
              icon={Stethoscope}
            />
          ) : (
            <ul className="divide-y">
              {query.data.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.phone ?? '—'} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

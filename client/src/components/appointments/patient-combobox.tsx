'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchInput } from '@/components/common/search-input';
import { EmptyState, LoadingState } from '@/components/common/states';
import { cn } from '@/lib/utils';
import { apiGetPage } from '@/lib/api/client';
import type { Patient } from '@/types/domain';

/** Qidiruvli bemor tanlovchi (booking formasi uchun). */
export function PatientCombobox({
  value,
  label,
  onSelect,
}: {
  value?: string;
  label?: string;
  onSelect: (patient: Patient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['patients', { search, page: 1, picker: true }],
    queryFn: () =>
      apiGetPage<Patient>(
        `/clinic/patients?page=1&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: open,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          !value && 'text-muted-foreground',
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <User className="h-4 w-4" />
          {label || 'Bemorni tanlang'}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bemorni tanlash</DialogTitle>
          </DialogHeader>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ism yoki telefon..."
          />
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {query.isLoading ? (
              <LoadingState />
            ) : !query.data?.items.length ? (
              <EmptyState title="Bemor topilmadi" />
            ) : (
              <ul className="divide-y">
                {query.data.items.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm transition-colors hover:bg-muted/50"
                    >
                      <span>
                        <span className="font-medium">{p.fullName}</span>
                        <span className="ml-2 text-muted-foreground">
                          {p.phone ?? ''}
                        </span>
                      </span>
                      {value === p.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { apiDelete, apiErrorMessage, apiGet } from '@/lib/api/client';
import type { ServiceCategory } from '@/types/domain';
import { CategoryFormDialog } from './category-form-dialog';

export function CategoriesPanel() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<ServiceCategory | null>(null);
  const [del, setDel] = useState<ServiceCategory | null>(null);

  const query = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => apiGet<ServiceCategory[]>('/clinic/service-categories'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/clinic/service-categories/${id}`),
    onSuccess: () => {
      toast.success("Kategoriya o'chirildi");
      qc.invalidateQueries({ queryKey: ['service-categories'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: Column<ServiceCategory>[] = [
    {
      key: 'name',
      header: 'Nomi',
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    { key: 'description', header: 'Tavsif', cell: (c) => c.description ?? '—' },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setEdit(c);
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
            onClick={() => setDel(c)}
            aria-label="O'chirish"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi kategoriya
        </Button>
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={query.data ?? []}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          empty={
            <EmptyState
              title="Kategoriya yo'q"
              description="Xizmatlarni guruhlash uchun kategoriya qo'shing."
              icon={FolderTree}
            />
          }
        />
      </Card>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEdit(null);
        }}
        category={edit}
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Kategoriyani o'chirish"
        description={del?.name}
        onConfirm={() => del && remove.mutateAsync(del.id)}
      />
    </div>
  );
}

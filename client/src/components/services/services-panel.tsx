'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { SearchInput } from '@/components/common/search-input';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { EmptyState } from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { apiDelete, apiErrorMessage, apiGet, apiGetPage } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import type { Service, ServiceCategory } from '@/types/domain';
import { ServiceFormDialog } from './service-form-dialog';
import { PriceHistoryDialog } from './price-history-dialog';

export function ServicesPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<Service | null>(null);
  const [del, setDel] = useState<Service | null>(null);
  const [history, setHistory] = useState<Service | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => apiGet<ServiceCategory[]>('/clinic/service-categories'),
  });
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—');
  }, [categories]);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  if (categoryId !== 'ALL') params.set('categoryId', categoryId);

  const query = useQuery({
    queryKey: ['services', { search, categoryId, page }],
    queryFn: () => apiGetPage<Service>(`/clinic/services?${params.toString()}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/clinic/services/${id}`),
    onSuccess: () => {
      toast.success("Xizmat o'chirildi");
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Xizmat',
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    { key: 'category', header: 'Kategoriya', cell: (s) => categoryName(s.categoryId) },
    { key: 'price', header: 'Narx', cell: (s) => formatMoney(s.price) },
    {
      key: 'duration',
      header: 'Davomiyligi',
      cell: (s) => (s.duration ? `${s.duration} daq` : '—'),
    },
    {
      key: 'isActive',
      header: 'Holat',
      cell: (s) => (
        <Badge variant={s.isActive ? 'success' : 'secondary'}>
          {s.isActive ? 'Faol' : 'Nofaol'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setHistory(s)}
            aria-label="Narx tarixi"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setEdit(s);
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
            onClick={() => setDel(s)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Xizmat nomi..."
            className="sm:max-w-xs"
          />
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Barcha kategoriya</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEdit(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi xizmat
        </Button>
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
              title="Xizmat topilmadi"
              icon={ClipboardList}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEdit(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Xizmat qo&apos;shish
                </Button>
              }
            />
          }
        />
        {query.data && query.data.items.length > 0 && (
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        )}
      </Card>

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEdit(null);
        }}
        service={edit}
        categories={categories}
      />
      <PriceHistoryDialog
        service={history}
        open={!!history}
        onOpenChange={(o) => !o && setHistory(null)}
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Xizmatni o'chirish"
        description={del?.name}
        onConfirm={() => del && remove.mutateAsync(del.id)}
      />
    </div>
  );
}

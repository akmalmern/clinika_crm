'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types/api';

/** Sahifalash boshqaruvi (oldingi/keyingi + jami). */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total } = meta;
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-3">
      <p className="text-sm text-muted-foreground">
        Jami: <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Oldingi
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Keyingi
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

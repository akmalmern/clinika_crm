'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/common/states';
import { apiGet } from '@/lib/api/client';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { PriceHistory, Service } from '@/types/domain';

/** Xizmat narx tarixi (kim/qachon, eski -> yangi). */
export function PriceHistoryDialog({
  service,
  open,
  onOpenChange,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ['price-history', service?.id],
    queryFn: () =>
      apiGet<PriceHistory[]>(`/clinic/services/${service!.id}/price-history`),
    enabled: open && !!service,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Narx tarixi — {service?.name}</DialogTitle>
        </DialogHeader>
        {query.isLoading ? (
          <LoadingState />
        ) : !query.data?.length ? (
          <EmptyState
            title="Narx o'zgarmagan"
            description="Hali narx tarixi yo'q."
            icon={History}
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {query.data.map((h) => (
              <li key={h.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-muted-foreground line-through">
                    {formatMoney(h.oldPrice)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatMoney(h.newPrice)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(h.changedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

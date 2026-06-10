import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Yuklanmoqda (markazlashtirilgan spinner). */
export function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-16 text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

/** Bo'sh holat (ma'lumot yo'q). */
export function EmptyState({
  title = "Ma'lumot yo'q",
  description,
  action,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Xato holati (qayta urinish bilan). */
export function ErrorState({
  message = "Ma'lumotni yuklab bo'lmadi",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}

/** Jadval skeleti (yuklanish paytida qatorlar). */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

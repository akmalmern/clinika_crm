import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Bo'sh sahifa skeleti (Phase 8A). Sarlavha + tavsif + "keyingi bosqichda
 * to'ldiriladi" ko'rsatkichi. Tarkib (jadval/forma) keyingi fazalarda qo'shiladi.
 */
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Construction className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">
            Bu bo&apos;lim keyingi bosqichda to&apos;ldiriladi
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Phase 8A — faqat asos, autentifikatsiya va bo&apos;sh panel
            skeletlari. Ma&apos;lumotlar va amallar keyingi fazalarda ulanadi.
          </p>
          <div className="mt-4 w-full max-w-lg space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-5/6" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

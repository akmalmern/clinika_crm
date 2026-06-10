import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatDef {
  label: string;
}

/**
 * Boshqaruv paneli skeleti (Phase 8A): salomlash + statistika kartochkalari
 * (bo'sh). Raqamlar keyingi fazada hisobot API'lariga ulanadi.
 */
export function WelcomeDashboard({
  greeting,
  subtitle,
  stats,
}: {
  greeting: string;
  subtitle: string;
  stats: StatDef[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faoliyat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">So&apos;nggi yangilanishlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/lib/constants';

/** Holatni rangli badge sifatida ko'rsatadi (label + variant xaritalari bilan). */
export function StatusBadge({
  value,
  labels,
  variants,
}: {
  value: string;
  labels: Record<string, string>;
  variants: Record<string, BadgeVariant>;
}) {
  return (
    <Badge variant={variants[value] ?? 'secondary'}>
      {labels[value] ?? value}
    </Badge>
  );
}

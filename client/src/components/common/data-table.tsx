'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, TableSkeleton } from './states';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/** Umumiy jadval: loading/error/empty holatlarini o'zi boshqaradi. */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <TableSkeleton cols={columns.length} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!data.length) return <>{empty ?? <EmptyState />}</>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key} className={c.className}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {columns.map((c) => (
              <TableCell key={c.key} className={c.className}>
                {c.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

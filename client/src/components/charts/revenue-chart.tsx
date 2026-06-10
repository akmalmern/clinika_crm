'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';

interface Point {
  label: string;
  value: number;
}

/** Daromad dinamikasi (davr bo'yicha) — to'ldirilgan chiziqli grafik. */
export function RevenueChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Ma&apos;lumot yo&apos;q
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(211 100% 43%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(211 100% 43%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1000
                ? `${Math.round(v / 1000)}k`
                : String(v)
          }
        />
        <Tooltip
          formatter={(v) => [formatMoney(Number(v)), 'Daromad']}
          labelStyle={{ color: 'hsl(222 47% 11%)' }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(214 32% 91%)',
            fontSize: 13,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(211 100% 43%)"
          strokeWidth={2}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

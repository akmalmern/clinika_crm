'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface PieDatum {
  name: string;
  value: number;
}

const COLORS = [
  'hsl(211 100% 43%)',
  'hsl(188 90% 34%)',
  'hsl(142 71% 38%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 55%)',
  'hsl(0 72% 51%)',
  'hsl(215 16% 47%)',
];

/** Doiraviy diagramma (holat/provayder kesimi). */
export function CategoryPie({
  data,
  valueFormatter,
}: {
  data: PieDatum[];
  valueFormatter?: (v: number) => string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Ma&apos;lumot yo&apos;q
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : v)}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(214 32% 91%)',
            fontSize: 13,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: 13 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

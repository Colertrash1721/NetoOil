'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';

type Point = { name: string; uv: number };

export default function FuelSparkline({ data }: { data: Point[] }) {
  // Altura NUMÉRICA dentro de ResponsiveContainer => no dependes del padre
  return (
    <ResponsiveContainer width="100%" height={56}>
      <LineChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 8 }}>
        <Line type="monotone" dataKey="uv" stroke="#9CA3AF" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

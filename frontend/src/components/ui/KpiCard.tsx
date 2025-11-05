'use client';

import { Card } from "@/components/ui/card";
import FuelSparkline from "@/components/ui/FuelSparkline";

type Point = { name: string; uv: number };

type props = {
    title?: string;
    value?: string;
    deltaText?: string;
    deltaUp?: boolean;
    data: Point[];
}

export default function KpiCard({
  title,
    value,
    deltaText,
    deltaUp,
    data
}: props) {
  return (
    <Card className="bg-white rounded-2xl p-4 shadow-md border border-black/5">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <span className="text-xs tracking-widest text-gray-400">{title}</span>
        <span className={`text-xs font-medium flex items-center gap-1 ${deltaUp ? "text-green-600" : "text-red-600"}`}>
          <span className={`w-2 h-2 rounded-full ${deltaUp ? "bg-green-500" : "bg-red-500"}`} />
          {deltaText}
        </span>
      </div>

      {/* Valor principal */}
      <div className="mt-1 text-3xl font-semibold text-gray-800">
        {value}
      </div>

      {/* Sparkline */}
      <div className="mt-2">
        <FuelSparkline data={data} />
      </div>
    </Card>
  );
}

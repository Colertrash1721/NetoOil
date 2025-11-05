// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { BusItem } from '@/types/buses';

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ChartDataPoint = {
  time: string;
  dieselReal: number | null;
  dieselEstimated: number | null;
  timestamp: string;
};

export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

export const prepareChartData = (bus: BusItem | undefined): ChartDataPoint[] => {
  if (!bus) return [];

  // Combinar datos reales y estimados
  const chartData = bus.DieselLevel.map((diesel, index) => {
    const estimated = bus.EstimatedLevel[index];
    
    return {
      time: formatTime(diesel.timestamp),
      dieselReal: diesel.number,
      dieselEstimated: estimated?.number || null,
      timestamp: diesel.timestamp
    };
  });

  // Agregar datos estimados futuros que no tienen medición real
  const futureEstimates = bus.EstimatedLevel
    .slice(bus.DieselLevel.length)
    .map((estimated) => ({
      time: formatTime(estimated.timestamp),
      dieselReal: null,
      dieselEstimated: estimated.number,
      timestamp: estimated.timestamp
    }));

  return [...chartData, ...futureEstimates].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};
// Export as alias for compatibility with Tremor components
export const tremorTwMerge = cx
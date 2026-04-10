import { BusItem } from '@/types/buses';

export function getLatestDiesel(bus: BusItem) {
  return bus.DieselLevel[bus.DieselLevel.length - 1]?.number ?? 0;
}

export function getLatestEstimated(bus: BusItem) {
  return bus.EstimatedLevel[bus.EstimatedLevel.length - 1]?.number ?? 0;
}

export function getFuelDelta(bus: BusItem) {
  return Math.abs(getLatestDiesel(bus) - getLatestEstimated(bus));
}

export function getBusTone(bus: BusItem) {
  const delta = getFuelDelta(bus);

  if (bus.status === 'Alerta' || delta >= 10) {
    return {
      badge: 'bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/30',
      accent: 'from-rose-500 to-orange-400',
    };
  }

  if (bus.status === 'En terminal') {
    return {
      badge: 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30',
      accent: 'from-amber-400 to-yellow-300',
    };
  }

  return {
    badge: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30',
    accent: 'from-cyan-400 to-emerald-300',
  };
}

export function formatRelativeHour(value: string) {
  return new Date(value).toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

'use client';

import { useEffect, useState } from 'react';
import { getVehicleDetailService, getVehiclesService, VehicleDetailApi } from '@/services/vehicles/service';
import { BusItem } from '@/types/buses';

type BusesProps = {
  returnSelectedBus: (busId: number) => void;
};

function mapStatus(status?: string | null): BusItem['status'] {
  const value = (status || '').toLowerCase();
  if (value.includes('alert') || value.includes('alarm')) {
    return 'Alerta';
  }
  if (value.includes('terminal') || value.includes('idle') || value.includes('inactive')) {
    return 'En terminal';
  }
  return 'En ruta';
}

function mapVehicle(detail: VehicleDetailApi): BusItem {
  const point = {
    number: detail.lastFuelLevel ?? 0,
    timestamp: detail.lastUpdate ?? detail.creationDate,
  };

  return {
    id: detail.id,
    name: `${detail.brand} ${detail.model}`.trim() || `Unidad ${detail.plate}`,
    engine: `${detail.brand} ${detail.model}`.trim() || 'Sin motor registrado',
    plate: detail.plate,
    route: detail.assignedCompanyName ?? 'Sin ruta registrada',
    driver: 'Sin chofer registrado',
    status: mapStatus(detail.status),
    location: {
      lat: detail.lastLatitude ?? 18.4861,
      lng: detail.lastLongitude ?? -69.9312,
      label: detail.assignedCompanyName ?? 'Sin ubicacion registrada',
    },
    DieselLevel: [point],
    EstimatedLevel: [{ ...point }],
    telemetry: {
      temperature: detail.lastTemperature ?? 0,
      inclination: detail.lastInclination ?? 0,
      volume: detail.lastVolume ?? 0,
      battery: detail.lastBatteryLevel ?? 0,
      pressure: detail.lastPressure ?? 0,
      humidity: detail.lastHumidity ?? 0,
      speed: detail.lastSpeed ?? 0,
      updatedAt: detail.lastUpdate ?? detail.creationDate,
    },
    events: [],
  };
}

function getLastLevel(bus: BusItem) {
  return {
    lastDiesel: bus.DieselLevel[bus.DieselLevel.length - 1],
    lastEstimated: bus.EstimatedLevel[bus.EstimatedLevel.length - 1],
  };
}

const levelColor = (real: number, pred: number) => {
  const diff = Math.abs(real - pred);
  if (diff >= 25) return 'text-red-600';
  if (diff >= 10) return 'text-amber-500';
  return 'text-blue-600';
};

export default function Buses({ returnSelectedBus }: BusesProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [buses, setBuses] = useState<BusItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const vehicles = await getVehiclesService();
      const details = await Promise.all(
        vehicles.map((vehicle) => getVehicleDetailService(vehicle.id).catch(() => null)),
      );
      const mapped = details
        .filter((detail): detail is VehicleDetailApi => detail !== null)
        .map((detail) => mapVehicle(detail));
      setBuses(mapped);
      setSelectedId(mapped[0]?.id ?? null);
      if (mapped[0]) {
        returnSelectedBus(mapped[0].id);
      }
    };

    void load();
  }, [returnSelectedBus]);

  return (
    <div className="bg-white h-full w-full rounded-xl shadow p-4">
      <h1 className="text-2xl font-extrabold tracking-wide text-center mb-4">Vehículos</h1>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-2.5rem)] pr-1">
        {buses.map((bus) => {
          const { lastDiesel, lastEstimated } = getLastLevel(bus);
          const selected = bus.id === selectedId;
          const iconColor = levelColor(lastDiesel.number, lastEstimated.number);

          return (
            <button
              key={bus.id}
              onClick={() => {
                returnSelectedBus(bus.id);
                setSelectedId(bus.id);
              }}
              className={[
                'w-full text-left flex items-center gap-3 px-3 py-3 rounded-2xl border shadow-sm transition',
                selected
                  ? 'bg-cyan-50 border-cyan-200 ring-cyan-200'
                  : 'bg-white border-gray-100 hover:border-gray-200 focus:ring-gray-300',
              ].join(' ')}
            >
              <div className="rounded-2xl p-2 shrink-0 bg-gray-50">
                <i className={`bx bx-bus text-3xl ${iconColor}`}></i>
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-gray-900">{bus.name}</div>
                <div className="text-gray-600">{bus.engine}</div>
                <div className="text-gray-600">Plate {bus.plate}</div>
                <div className="text-xs text-gray-500">
                  Real: {lastDiesel.number}% · Predicho: {lastEstimated.number}% · Δ = {Math.abs(lastDiesel.number - lastEstimated.number)}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

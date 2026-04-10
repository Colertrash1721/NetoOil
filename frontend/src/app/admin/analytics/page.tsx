'use client';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import KpiCard from '@/components/ui/KpiCard';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BusItem } from '@/types/buses';
import { prepareChartData } from '@/lib/utils';
import { getVehicleDetailService, getVehiclesService, VehicleDetailApi } from '@/services/vehicles/service';

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
  const points = detail.telemetryHistory.length > 0
    ? [...detail.telemetryHistory].reverse().map((item) => ({
        number: item.fuelLevel ?? 0,
        timestamp: item.recordedAt,
      }))
    : [{
        number: detail.lastFuelLevel ?? 0,
        timestamp: detail.lastUpdate ?? detail.creationDate,
      }];

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
    DieselLevel: points,
    EstimatedLevel: points.map((item) => ({ ...item })),
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

const data = [
  { name: 'January', uv: 4000 },
  { name: 'February', uv: 3000 },
  { name: 'March', uv: 5000 },
  { name: 'April', uv: 4000 },
  { name: 'May', uv: 6000 },
  { name: 'June', uv: 7000 },
  { name: 'July', uv: 8000 },
  { name: 'August', uv: 6000 },
  { name: 'September', uv: 7000 },
  { name: 'October', uv: 8000 },
  { name: 'November', uv: 9000 },
  { name: 'December', uv: 10000 },
];

export default function AnalyticsPage() {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const day = new Date().getDate().toString().padStart(2, '0');
  const [selectedDate, setSelectedDate] = useState(year + '-' + month + '-' + day);
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [busSelected, setBusSelected] = useState<BusItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const vehicles = await getVehiclesService();
        const details = await Promise.all(
          vehicles.map((vehicle) => getVehicleDetailService(vehicle.id).catch(() => null)),
        );
        const mapped = details
          .filter((detail): detail is VehicleDetailApi => detail !== null)
          .map((detail) => mapVehicle(detail));
        setBuses(mapped);
        setSelectedBusId(mapped[0]?.id ?? null);
        setBusSelected(mapped[0] ?? null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const selectedBus = (busId: number) => {
    setSelectedBusId(busId);
    const bus = buses.find((item) => item.id === busId);
    if (bus) {
      setBusSelected(bus);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const chartData = useMemo(() => {
    if (!busSelected) {
      return [];
    }
    return prepareChartData(busSelected);
  }, [busSelected]);

  const totalConsumption = useMemo(() => {
    return buses.reduce((sum, bus) => {
      const first = bus.DieselLevel[0]?.number ?? 0;
      const last = bus.DieselLevel[bus.DieselLevel.length - 1]?.number ?? 0;
      return sum + Math.max(0, first - last);
    }, 0);
  }, [buses]);

  const avgSpeed = useMemo(() => {
    if (buses.length === 0) {
      return 0;
    }
    return buses.reduce((sum, bus) => sum + bus.telemetry.speed, 0) / buses.length;
  }, [buses]);

  const alertCount = useMemo(() => {
    return buses.filter((bus) => bus.status === 'Alerta').length;
  }, [buses]);

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow">Cargando datos...</div>;
  }

  if (!busSelected) {
    return <div className="rounded-xl bg-white p-6 shadow">No hay vehículos registrados.</div>;
  }

  return (
    <div className="grid grid-rows-3 gap-4 min-h-[600px] h-full w-full">
      <div className="flex flex-col gap-4 w-full h-fit">
        <div className="flex gap-4 md:gap-0 lg:gap-0 flex-col md:flex-row lg:flex-row items-center justify-between">
          <div className="text-sm text-slate-700 font-medium">Analítica real de la flota</div>
          <div className="w-full flex-col md:w-1/2 lg:w-1/2 flex md:flex-row lg:flex-row justify-end gap-4">
            <input type="date" className='bg-white p-2 w-1/2' value={selectedDate} onChange={handleDateChange} />
            <button><i className='bx bxs-file-pdf bg-white p-2 h-full text-3xl text-red-600 rounded shadow cursor-pointer'></i></button>
          </div>
        </div>
        <div className="flex flex-row gap-4 ">
          <KpiCard title="Consumo" value={`${totalConsumption.toFixed(1)} pts`} deltaUp data={data} />
          <KpiCard title="Recorrido" value={`${buses.length} unidades`} deltaUp={false} data={data} />
          <KpiCard title="Estado" value={`${alertCount} alertas`} deltaText={`Velocidad media ${avgSpeed.toFixed(1)} km/h`} deltaUp={alertCount === 0} data={data} />
        </div>
      </div>
      <div className="flex flex-row gap-4 row-span-3 w-full h-full">
        <div className="w-1/2 h-full overflow-y-auto rounded-xl bg-white p-4 shadow">
          <h1 className="text-2xl font-extrabold tracking-wide text-center mb-4">Vehículos</h1>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-2.5rem)] pr-1">
            {buses.map((bus) => (
              <button
                key={bus.id}
                onClick={() => selectedBus(bus.id)}
                className={[
                  'w-full text-left flex items-center gap-3 px-3 py-3 rounded-2xl border shadow-sm transition',
                  selectedBusId === bus.id
                    ? 'bg-cyan-50 border-cyan-200 ring-cyan-200'
                    : 'bg-white border-gray-100 hover:border-gray-200',
                ].join(' ')}
              >
                <div className="leading-tight">
                  <div className="font-extrabold text-gray-900">{bus.name}</div>
                  <div className="text-gray-600">{bus.engine}</div>
                  <div className="text-gray-600">Plate {bus.plate}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 h-full w-full">
          <div className="bg-white h-1/2 w-full p-4 rounded shadow">
            <h1 className='text-center font-bold tracking-[1.5px] mb-4'>
              Nivel Real vs Estimado - {busSelected.name}
            </h1>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => [`${value}%`, 'Nivel']} labelFormatter={(label) => `Hora: ${label}`} />
                <Legend />
                <Area type="monotone" dataKey="dieselReal" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="Nivel Real" strokeWidth={2} />
                <Area type="monotone" dataKey="dieselEstimated" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="Nivel Estimado" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white h-1/2 w-full p-4 rounded shadow">
            <h1 className='text-center font-bold tracking-[1.5px] mb-4'>
              Error de Predicción - {busSelected.name}
            </h1>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={chartData.filter(item => item.dieselReal !== null && item.dieselEstimated !== null)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} label={{ value: '% Error', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => [`${Math.abs(Number(value)).toFixed(1)}%`, 'Error']} labelFormatter={(label) => `Hora: ${label}`} />
                <Legend />
                <Area type="monotone" dataKey={(data) => Math.abs(data.dieselReal - data.dieselEstimated)} stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} name="Error Absoluto" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

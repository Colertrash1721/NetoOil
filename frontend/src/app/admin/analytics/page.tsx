'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BusItem } from '@/types/buses';
import { prepareChartData } from '@/lib/utils';
import { getVehicleDetailService, getVehiclesService, VehicleDetailApi } from '@/services/vehicles/service';

function mapStatus(status?: string | null): BusItem['status'] {
  const value = (status || '').toLowerCase();
  if (value.includes('alert') || value.includes('alarm')) return 'Alerta';
  if (value.includes('terminal') || value.includes('idle') || value.includes('inactive')) return 'En terminal';
  return 'En ruta';
}

function mapVehicle(detail: VehicleDetailApi): BusItem {
  const points = detail.telemetryHistory.length > 0
    ? [...detail.telemetryHistory].reverse().map((item) => ({
        number: item.fuelLevel ?? 0,
        timestamp: item.recordedAt,
      }))
    : [{ number: detail.lastFuelLevel ?? 0, timestamp: detail.lastUpdate ?? detail.creationDate }];

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

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-xl text-cyan-700">
          <i className={`bx ${icon}`} />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </article>
  );
}

export default function AnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
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

  const chartData = useMemo(() => {
    if (!busSelected) return [];
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
    if (buses.length === 0) return 0;
    return buses.reduce((sum, bus) => sum + bus.telemetry.speed, 0) / buses.length;
  }, [buses]);

  const alertCount = buses.filter((bus) => bus.status === 'Alerta').length;

  if (loading) {
    return <div className="rounded-lg bg-white p-6 text-slate-600 shadow-sm">Cargando analítica...</div>;
  }

  if (!busSelected) {
    return <div className="rounded-lg bg-white p-6 text-slate-600 shadow-sm">No hay vehículos registrados.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/75">Analítica real</p>
            <h1 className="mt-2 text-3xl font-semibold">Flota y combustible</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Comparación de nivel real, modelo estimado, alertas y estabilidad de lectura por vehículo.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="date"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50">
              <i className="bx bxs-file-pdf text-lg text-red-600" />
              PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Consumo" value={`${totalConsumption.toFixed(1)} pts`} detail="Consumo acumulado en la muestra" icon="bx-droplet" />
        <MetricCard title="Unidades" value={`${buses.length}`} detail="Vehículos con telemetría disponible" icon="bx-car" />
        <MetricCard title="Estado" value={`${alertCount} alertas`} detail={`Velocidad media ${avgSpeed.toFixed(1)} km/h`} icon="bx-pulse" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Vehículos</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Selección</h2>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {buses.length}
            </span>
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {buses.map((bus) => (
              <button
                key={bus.id}
                onClick={() => {
                  setSelectedBusId(bus.id);
                  setBusSelected(bus);
                }}
                className={[
                  'w-full rounded-lg border px-3 py-3 text-left transition',
                  selectedBusId === bus.id
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{bus.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{bus.plate}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {bus.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="grid gap-4">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Nivel</p>
                <h2 className="text-xl font-semibold text-slate-950">Real vs estimado - {busSelected.name}</h2>
              </div>
              <span className="text-sm font-medium text-slate-500">{busSelected.plate}</span>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis width={40} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Nivel']} labelFormatter={(label) => `Hora: ${label}`} />
                  <Legend />
                  <Area type="monotone" dataKey="dieselReal" stroke="#0891b2" fill="#67e8f9" fillOpacity={0.45} name="Nivel real" strokeWidth={2} />
                  <Area type="monotone" dataKey="dieselEstimated" stroke="#f59e0b" fill="#fcd34d" fillOpacity={0.25} name="Nivel estimado" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Precisión</p>
              <h2 className="text-xl font-semibold text-slate-950">Error de predicción</h2>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.filter((item) => item.dieselReal !== null && item.dieselEstimated !== null)} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis width={40} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${Math.abs(Number(value)).toFixed(1)}%`, 'Error']} labelFormatter={(label) => `Hora: ${label}`} />
                  <Area type="monotone" dataKey={(item) => Math.abs(item.dieselReal - item.dieselEstimated)} stroke="#e11d48" fill="#fb7185" fillOpacity={0.25} name="Error absoluto" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

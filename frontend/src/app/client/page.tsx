'use client';

import { useBusContext } from '@/hooks/client/provider';
import {
  formatRelativeHour,
  getFuelDelta,
  getLatestDiesel,
  getLatestEstimated,
} from '@/hooks/client/vehicleUi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
    <article className="rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl text-cyan-200">
          <i className={icon}></i>
        </div>
      </div>
    </article>
  );
}

export default function ClientDashboardPage() {
  const { buses, busSelected } = useBusContext();
  const bus = busSelected;

  if (!bus) {
    return (
      <section className="rounded-[32px] border border-dashed border-white/10 bg-white/5 p-8 text-slate-200 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Sin datos</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">No hay vehiculos cargados</h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          La vista usa solo datos reales y no hay registros disponibles para mostrar.
        </p>
      </section>
    );
  }

  const currentDiesel = getLatestDiesel(bus);
  const currentEstimated = getLatestEstimated(bus);
  const delta = getFuelDelta(bus);
  const averageDiesel = bus.DieselLevel.reduce((sum, point) => sum + point.number, 0) / bus.DieselLevel.length;
  const consumption = Math.max(0, bus.DieselLevel[0].number - currentDiesel);

  const fuelSeries = bus.DieselLevel.map((item, index) => ({
    time: formatRelativeHour(item.timestamp),
    real: item.number,
    estimated: bus.EstimatedLevel[index]?.number ?? item.number,
    error: Math.abs(item.number - (bus.EstimatedLevel[index]?.number ?? item.number)),
  }));

  const telemetryBars = [
    { name: 'Temp', value: bus.telemetry.temperature, fill: '#22d3ee' },
    { name: 'Incli', value: bus.telemetry.inclination, fill: '#f97316' },
    { name: 'Presión', value: bus.telemetry.pressure, fill: '#a78bfa' },
    { name: 'Humedad', value: bus.telemetry.humidity, fill: '#34d399' },
  ];

  const fleetHealth = buses
    .map((item) => ({
      name: item.name,
      plate: item.plate,
      fuel: getLatestDiesel(item),
      delta: getFuelDelta(item),
      status: item.status,
    }))
    .sort((left, right) => left.delta - right.delta);

  const severityStyles: Record<string, string> = {
    CRITICAL: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
    WARNING: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    INFO: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f2942_0%,#114e67_42%,#d97706_130%)] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr] xl:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/75">Unidad activa</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">{bus.name}</h2>
            <p className="mt-3 max-w-2xl text-sm text-cyan-50/85 md:text-base">
              Supervisión del consumo, ubicación y estabilidad del sensor de la unidad seleccionada.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white">{bus.plate}</span>
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white">Chofer: {bus.driver}</span>
              <span className="rounded-full bg-slate-950/25 px-4 py-2 text-sm font-medium text-white">Fuente: Base de datos</span>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/20 p-4 backdrop-blur-sm sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/70">Última actualización</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatRelativeHour(bus.telemetry.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/70">Ubicación</p>
              <p className="mt-2 text-lg font-semibold text-white">{bus.location.label || 'Sin ubicacion registrada'}</p>
              <p className="text-sm text-cyan-50/75">{bus.location.lat.toFixed(4)}, {bus.location.lng.toFixed(4)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard title="Nivel real" value={`${currentDiesel.toFixed(1)}%`} detail="Lectura más reciente del tanque" icon="bx bx-droplet" />
        <MetricCard title="Modelo estimado" value={`${currentEstimated.toFixed(1)}%`} detail={`Desvío actual de ${delta.toFixed(1)}%`} icon="bx bx-line-chart" />
        <MetricCard title="Consumo del turno" value={`${consumption.toFixed(1)} pts`} detail={`Promedio del día ${averageDiesel.toFixed(1)}%`} icon="bx bx-trending-down" />
        <MetricCard title="Velocidad" value={`${bus.telemetry.speed.toFixed(0)} km/h`} detail={`Estado operativo: ${bus.status}`} icon="bx bx-gauge" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Comparativa</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Combustible real vs estimado</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300">Serie histórica del vehículo seleccionado</span>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fuelSeries} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fuelReal" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fuelEstimated" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Area type="monotone" dataKey="real" stroke="#38bdf8" fill="url(#fuelReal)" strokeWidth={2.5} name="Nivel real" />
                <Area type="monotone" dataKey="estimated" stroke="#f59e0b" fill="url(#fuelEstimated)" strokeWidth={2.5} name="Nivel estimado" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sensor</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Snapshot de telemetría</h3>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">Actualizado {formatRelativeHour(bus.telemetry.updatedAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Temperatura</p><p className="mt-1 text-lg font-semibold text-white">{bus.telemetry.temperature.toFixed(1)}°C</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Inclinación</p><p className="mt-1 text-lg font-semibold text-white">{bus.telemetry.inclination.toFixed(1)}°</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Volumen</p><p className="mt-1 text-lg font-semibold text-white">{bus.telemetry.volume.toFixed(1)} L</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Batería</p><p className="mt-1 text-lg font-semibold text-white">{bus.telemetry.battery.toFixed(0)}%</p></div>
            </div>
          </article>

          <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Eventos</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Incidentes recientes</h3>
              </div>
              <span className="text-xs text-slate-400">{bus.events.length} registros</span>
            </div>
            <div className="space-y-3">
              {bus.events.map((event) => (
                <div key={event.id} className={`rounded-[24px] border px-4 py-3 ${severityStyles[event.severity]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{event.type}</p>
                    <span className="text-xs uppercase tracking-[0.25em]">{event.severity}</span>
                  </div>
                  <p className="mt-2 text-sm opacity-90">{event.detail}</p>
                  <div className="mt-3 flex items-center justify-between text-xs opacity-75">
                    <span>{event.location}</span>
                    <span>{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Precisión</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Error del modelo por lectura</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300">Meta ideal &lt; 5%</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fuelSeries} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="error" stroke="#fb7185" strokeWidth={3} dot={{ r: 3, fill: '#fb7185' }} name="Error" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Flota</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Ranking de estabilidad</h3>
            </div>
            <span className="text-xs text-slate-400">Ordenado por menor error</span>
          </div>
          <div className="mb-4 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetryBars} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {telemetryBars.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {fleetHealth.map((item, index) => (
              <div key={item.plate} className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-3 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white">{index + 1}. {item.name}</p>
                  <p className="text-xs text-slate-500">{item.plate} · {item.status}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">Δ {item.delta.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">Fuel {item.fuel.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

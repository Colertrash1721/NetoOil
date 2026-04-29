'use client';

import { useBusContext } from '@/hooks/client/provider';
import { getLatestDiesel } from '@/hooks/client/vehicleUi';
import { useEffect, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const tanks = Array.from({ length: 10 }, (_, index) => {
  const unit = index + 1;
  const capacity = 18000 + unit * 1500;
  const fillPercent = 52 + (unit % 4) * 8;
  return {
    id: unit,
    code: `TNK-${unit.toString().padStart(2, '0')}`,
    location: `Patio operativo ${unit.toString().padStart(2, '0')}`,
    capacity,
    currentVolume: Math.round(capacity * (fillPercent / 100)),
    fillPercent,
    temperature: 27 + (unit % 5),
    density: 0.82 + (unit % 3) * 0.01,
    status: 'Operacional',
  };
});

const dispensers = Array.from({ length: 10 }, (_, index) => {
  const unit = index + 1;
  return {
    id: unit,
    code: `DSP-${unit.toString().padStart(2, '0')}`,
    tankCode: `TNK-${unit.toString().padStart(2, '0')}`,
    totalizer: 25000 + unit * 875,
    status: unit % 5 === 0 ? 'Mantenimiento' : 'Online',
    location: `Isla ${unit.toString().padStart(2, '0')}`,
  };
});

const transactions = Array.from({ length: 30 }, (_, index) => {
  const unit = index + 1;
  return {
    id: unit,
    code: `TX-DEMO-${unit.toString().padStart(4, '0')}`,
    vehicle: `NF-${unit.toString().padStart(3, '0')}`,
    driver: `Chofer Demo ${unit.toString().padStart(2, '0')}`,
    dispenser: `DSP-${(((unit - 1) % 10) + 1).toString().padStart(2, '0')}`,
    volume: 28 + (unit % 12) * 2,
    method: ['RFID', 'Tarjeta', 'ANPR', 'BLE'][unit % 4],
    status: 'Preautorizada',
  };
});

const numberFormat = new Intl.NumberFormat('es-DO', {
  maximumFractionDigits: 1,
});

function volume(value: number) {
  return `${numberFormat.format(value)} L`;
}

function DemoCard({
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
          <i className={`bx ${icon}`} />
        </div>
      </div>
    </article>
  );
}

export default function ClientDemoPage() {
  const { buses, dataSource, loadDemoFleet } = useBusContext();

  useEffect(() => {
    if (dataSource !== 'demo') {
      loadDemoFleet();
    }
  }, [dataSource, loadDemoFleet]);

  const totalCapacity = tanks.reduce((sum, tank) => sum + tank.capacity, 0);
  const storedVolume = tanks.reduce((sum, tank) => sum + tank.currentVolume, 0);
  const dispensedVolume = transactions.reduce((sum, transaction) => sum + transaction.volume, 0);
  const unreconciledFuel = Math.abs(dispensedVolume - dispensedVolume * 0.97);
  const averageFuel = buses.length
    ? buses.reduce((sum, bus) => sum + getLatestDiesel(bus), 0) / buses.length
    : 0;

  const tankChart = useMemo(() => {
    return tanks.map((tank) => ({
      name: tank.code,
      volumen: tank.currentVolume,
      capacidad: tank.capacity,
    }));
  }, []);

  const dispenserChart = useMemo(() => {
    return dispensers.map((dispenser) => ({
      name: dispenser.code,
      totalizador: dispenser.totalizer,
    }));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f2942_0%,#155e75_48%,#0f766e_130%)] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/75">Modo demo cliente</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Gestión integral de combustible</h2>
            <p className="mt-3 max-w-3xl text-sm text-cyan-50/85 md:text-base">
              Datos precargados para validar monitoreo de flota, tanques institucionales, surtidores, despacho, políticas y conciliación.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDemoFleet}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50"
          >
            <i className="bx bx-refresh" />
            Recargar demo
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <DemoCard title="Vehículos demo" value={`${buses.length || 50}`} detail={`Nivel promedio ${averageFuel.toFixed(1)}%`} icon="bx-bus" />
        <DemoCard title="Tanques" value={`${tanks.length}`} detail={`${volume(storedVolume)} de ${volume(totalCapacity)}`} icon="bx-cylinder" />
        <DemoCard title="Surtidores" value={`${dispensers.length}`} detail={`${dispensers.filter((item) => item.status === 'Online').length} disponibles`} icon="bx-gas-pump" />
        <DemoCard title="No conciliado" value={volume(unreconciledFuel)} detail={`${transactions.length} transacciones demo`} icon="bx-git-compare" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white">Almacenamiento por tanque</h3>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tankChart} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
                <Bar dataKey="capacidad" fill="#334155" radius={[4, 4, 0, 0]} name="Capacidad" />
                <Bar dataKey="volumen" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Volumen" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white">Totalizadores por surtidor</h3>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispenserChart} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
                <Bar dataKey="totalizador" fill="#34d399" radius={[4, 4, 0, 0]} name="Totalizador" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white">Tanques institucionales</h3>
          <div className="mt-4 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-slate-200">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Ubicación</th>
                  <th className="px-3 py-2">Nivel</th>
                  <th className="px-3 py-2">Temp.</th>
                  <th className="px-3 py-2">Densidad</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((tank) => (
                  <tr key={tank.id} className="border-b border-white/10">
                    <td className="px-3 py-2 font-semibold text-white">{tank.code}</td>
                    <td className="px-3 py-2">{tank.location}</td>
                    <td className="px-3 py-2">{tank.fillPercent.toFixed(1)}%</td>
                    <td className="px-3 py-2">{tank.temperature.toFixed(1)} C</td>
                    <td className="px-3 py-2">{tank.density.toFixed(3)}</td>
                    <td className="px-3 py-2">{tank.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white">Despachos demo</h3>
          <div className="mt-4 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-slate-200">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Vehículo</th>
                  <th className="px-3 py-2">Chofer</th>
                  <th className="px-3 py-2">Surtidor</th>
                  <th className="px-3 py-2">Volumen</th>
                  <th className="px-3 py-2">Identificación</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 15).map((transaction) => (
                  <tr key={transaction.id} className="border-b border-white/10">
                    <td className="px-3 py-2 font-semibold text-white">{transaction.code}</td>
                    <td className="px-3 py-2">{transaction.vehicle}</td>
                    <td className="px-3 py-2">{transaction.driver}</td>
                    <td className="px-3 py-2">{transaction.dispenser}</td>
                    <td className="px-3 py-2">{volume(transaction.volume)}</td>
                    <td className="px-3 py-2">{transaction.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

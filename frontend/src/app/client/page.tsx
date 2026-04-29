'use client';

import {
  FuelDashboardApi,
  getFuelDashboardService,
  getFuelTransactionsService,
  DispenserApi,
  RefuelingTransactionApi,
  TankApi,
} from '@/services/fuel/service';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const numberFormat = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 });

function volume(value: number) {
  return `${numberFormat.format(value)} L`;
}

function escapeCell(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function downloadExcelFile(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>) {
  const content = sections.map((section) => {
    const headers = Object.keys(section.rows[0] ?? { mensaje: 'Sin datos' });
    const rows = section.rows.length > 0 ? section.rows : [{ mensaje: 'Sin datos' }];
    return `
      <h2>${escapeCell(section.title)}</h2>
      <table border="1">
        <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
  }).join('<br />');

  const blob = new Blob([`<html><head><meta charset="UTF-8" /></head><body>${content}</body></html>`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function transactionRows(transactions: RefuelingTransactionApi[]) {
  return transactions.map((transaction) => ({
    codigo: transaction.transactionCode,
    vehiculo: transaction.vehiclePlate ?? transaction.vehicleId,
    chofer: transaction.driverName ?? '',
    dispensador: transaction.dispenserCode ?? transaction.dispenserId,
    tanque: transaction.tankCode ?? transaction.tankId,
    volumen: transaction.dispensedVolume,
    metodo: transaction.identificationMethod,
    preautorizada: transaction.preAuthorized ? 'Si' : 'No',
    estado: transaction.status,
    fecha: transaction.completedAt ?? transaction.startedAt,
  }));
}

function buildDemoTanks(): TankApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;
    const capacity = 18000 + unit * 1500;
    const fillPercent = 52 + (unit % 4) * 8;
    const currentVolume = Math.round(capacity * (fillPercent / 100));

    return {
      id: 9000 + unit,
      code: `TNK-${unit.toString().padStart(2, '0')}`,
      name: `Tanque Institucional ${unit.toString().padStart(2, '0')}`,
      location: `Patio operativo ${unit.toString().padStart(2, '0')}`,
      fuelType: 'diesel',
      capacity,
      currentVolume,
      temperature: 27 + (unit % 5),
      density: 0.82 + (unit % 3) * 0.01,
      status: 'operational',
      sensorIdentifier: `TANK-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      fillPercent,
      availableCapacity: capacity - currentVolume,
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}

function buildDemoDispensers(): DispenserApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;

    return {
      id: 8000 + unit,
      code: `DSP-${unit.toString().padStart(2, '0')}`,
      name: `Dispensador ${unit.toString().padStart(2, '0')}`,
      location: `Isla ${unit.toString().padStart(2, '0')}`,
      tankId: 9000 + unit,
      tankCode: `TNK-${unit.toString().padStart(2, '0')}`,
      totalizer: 25000 + unit * 875,
      status: unit % 5 === 0 ? 'maintenance' : 'online',
      deviceIdentifier: `DISP-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      lastTransactionAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}

function KpiCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: string }) {
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

function TankDetail({ tank }: { tank: TankApi }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tanque seleccionado</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">{tank.code}</h3>
          <p className="mt-2 text-sm text-slate-300">{tank.name} · {tank.location}</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-100">
          {tank.status}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Volumen</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(tank.currentVolume)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Capacidad</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(tank.capacity)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Temperatura</p>
          <p className="mt-2 text-xl font-semibold text-white">{tank.temperature?.toFixed(1) ?? 'N/D'} C</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Densidad</p>
          <p className="mt-2 text-xl font-semibold text-white">{tank.density?.toFixed(3) ?? 'N/D'}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
          <span>Nivel de llenado</span>
          <span>{tank.fillPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.min(100, Math.max(0, tank.fillPercent))}%` }} />
        </div>
      </div>
    </article>
  );
}

function DispenserDetail({ dispenser }: { dispenser: DispenserApi }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispensador seleccionado</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">{dispenser.code}</h3>
          <p className="mt-2 text-sm text-slate-300">{dispenser.name} · {dispenser.location}</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-100">
          {dispenser.status}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Totalizador</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(dispenser.totalizer)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tanque origen</p>
          <p className="mt-2 text-xl font-semibold text-white">{dispenser.tankCode ?? dispenser.tankId}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Dispositivo</p>
          <p className="mt-2 text-xl font-semibold text-white">{dispenser.deviceIdentifier ?? 'N/D'}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Último despacho</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {dispenser.lastTransactionAt ? new Date(dispenser.lastTransactionAt).toLocaleDateString('es-DO') : 'N/D'}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<FuelDashboardApi | null>(null);
  const [transactions, setTransactions] = useState<RefuelingTransactionApi[]>([]);
  const [viewMode, setViewMode] = useState<'tanks' | 'dispensers'>('tanks');
  const [selectedTankId, setSelectedTankId] = useState<number | null>(null);
  const [selectedDispenserId, setSelectedDispenserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashboardData, transactionData] = await Promise.all([
          getFuelDashboardService().catch(() => null),
          getFuelTransactionsService(500).catch(() => []),
        ]);
        setDashboard(dashboardData);
        setTransactions(transactionData);
        setSelectedTankId((current) => current ?? dashboardData?.tanks[0]?.id ?? null);
        setSelectedDispenserId((current) => current ?? dashboardData?.dispensers[0]?.id ?? null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const kpis = dashboard?.kpis;
  const tanks = dashboard?.tanks?.length ? dashboard.tanks : buildDemoTanks();
  const dispensers = dashboard?.dispensers?.length ? dashboard.dispensers : buildDemoDispensers();
  const selectedTank = tanks.find((tank) => tank.id === selectedTankId) ?? tanks[0] ?? null;
  const selectedDispenser = dispensers.find((dispenser) => dispenser.id === selectedDispenserId) ?? dispensers[0] ?? null;
  const totalTankCapacity = kpis?.totalTankCapacity ?? tanks.reduce((sum, tank) => sum + tank.capacity, 0);
  const totalStoredVolume = kpis?.totalStoredVolume ?? tanks.reduce((sum, tank) => sum + tank.currentVolume, 0);
  const globalFillPercent = kpis?.globalFillPercent ?? (totalTankCapacity ? (totalStoredVolume / totalTankCapacity) * 100 : 0);
  const onlineDispensers = kpis?.onlineDispensers ?? dispensers.filter((dispenser) => dispenser.status === 'online').length;

  const tankChart = useMemo(() => tanks.map((tank) => ({
    name: tank.code,
    volumen: tank.currentVolume,
    capacidad: tank.capacity,
  })), [tanks]);

  const dispenserChart = useMemo(() => dispensers.map((dispenser) => ({
    name: dispenser.code,
    totalizador: dispenser.totalizer,
  })), [dispensers]);

  const fuelDistribution = [
    { name: 'Almacenado', value: totalStoredVolume, fill: '#22d3ee' },
    { name: 'Disponible', value: tanks.reduce((sum, tank) => sum + tank.availableCapacity, 0), fill: '#34d399' },
    { name: 'No conciliado', value: kpis?.unreconciledFuel ?? 0, fill: '#fb7185' },
  ].filter((item) => item.value > 0);

  const exportAll = () => {
    downloadExcelFile('netofuel_tanques_dispensadores.xls', [
      {
        title: 'Resumen',
        rows: [{
          tanques: tanks.length,
          dispensadores: dispensers.length,
          volumen_almacenado: totalStoredVolume,
          capacidad_global: totalTankCapacity,
          volumen_dispensado: kpis?.volumeDispensed ?? 0,
          no_conciliado: kpis?.unreconciledFuel ?? 0,
        }],
      },
      { title: 'Tanques', rows: tanks },
      { title: 'Dispensadores', rows: dispensers },
      { title: 'Transacciones', rows: transactionRows(transactions.length ? transactions : dashboard?.recentTransactions ?? []) },
    ]);
  };

  if (loading) {
    return <div className="rounded-[30px] border border-white/10 bg-white/6 p-6 text-slate-200">Cargando dashboard...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f2942_0%,#155e75_48%,#0f766e_130%)] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/75">Dashboard principal</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Tanques y dispensadores</h2>
            <p className="mt-3 max-w-3xl text-sm text-cyan-50/85 md:text-base">
              Vista dedicada a almacenamiento, disponibilidad, dispensadores, despacho y conciliación.
            </p>
          </div>
          <button
            type="button"
            onClick={exportAll}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50"
          >
            <i className="bx bx-table" />
            Exportar Excel
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <KpiCard title="Combustible almacenado" value={volume(totalStoredVolume)} detail={`${globalFillPercent.toFixed(1)}% de capacidad global`} icon="bx-cylinder" />
        <KpiCard title="Capacidad global" value={volume(totalTankCapacity)} detail={`${tanks.length} tanques registrados`} icon="bx-data" />
        <KpiCard title="Dispensado" value={volume(kpis?.volumeDispensed ?? 0)} detail={`${kpis?.validTransactions ?? 0} transacciones válidas`} icon="bx-gas-pump" />
        <KpiCard title="Dispensadores online" value={`${onlineDispensers}`} detail={`${dispensers.length} dispensadores registrados`} icon="bx-transfer" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Selección</p>
              <h3 className="mt-1 text-xl font-semibold text-white">
                {viewMode === 'tanks' ? 'Tanques' : 'Dispensadores'}
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs text-slate-300">
              {viewMode === 'tanks' ? tanks.length : dispensers.length}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-slate-950/35 p-1">
            <button
              type="button"
              onClick={() => setViewMode('tanks')}
              className={[
                'rounded-[18px] px-3 py-2 text-sm font-semibold transition',
                viewMode === 'tanks' ? 'bg-emerald-300 text-slate-950' : 'text-slate-300 hover:bg-white/8',
              ].join(' ')}
            >
              Tanques
            </button>
            <button
              type="button"
              onClick={() => setViewMode('dispensers')}
              className={[
                'rounded-[18px] px-3 py-2 text-sm font-semibold transition',
                viewMode === 'dispensers' ? 'bg-amber-300 text-slate-950' : 'text-slate-300 hover:bg-white/8',
              ].join(' ')}
            >
              Dispensadores
            </button>
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {viewMode === 'tanks' ? tanks.map((tank) => {
              const selected = selectedTank?.id === tank.id;
              return (
                <button
                  key={tank.id}
                  type="button"
                  onClick={() => setSelectedTankId(tank.id)}
                  className={[
                    'w-full rounded-[24px] border p-4 text-left transition',
                    selected ? 'border-emerald-300/35 bg-white/12' : 'border-white/10 bg-white/5 hover:bg-white/8',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{tank.code}</p>
                      <p className="mt-1 text-sm text-slate-400">{tank.location}</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                      {tank.fillPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, tank.fillPercent))}%` }} />
                  </div>
                </button>
              );
            }) : dispensers.map((dispenser) => {
              const selected = selectedDispenser?.id === dispenser.id;
              return (
                <button
                  key={dispenser.id}
                  type="button"
                  onClick={() => setSelectedDispenserId(dispenser.id)}
                  className={[
                    'w-full rounded-[24px] border p-4 text-left transition',
                    selected ? 'border-amber-300/35 bg-white/12' : 'border-white/10 bg-white/5 hover:bg-white/8',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{dispenser.code}</p>
                      <p className="mt-1 text-sm text-slate-400">{dispenser.location}</p>
                    </div>
                    <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      {dispenser.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Tanque</p>
                      <p className="mt-1 font-semibold text-white">{dispenser.tankCode ?? dispenser.tankId}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Totalizador</p>
                      <p className="mt-1 font-semibold text-white">{volume(dispenser.totalizer)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-4">
          {viewMode === 'tanks' && selectedTank ? <TankDetail tank={selectedTank} /> : null}
          {viewMode === 'dispensers' && selectedDispenser ? <DispenserDetail dispenser={selectedDispenser} /> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tanques</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Capacidad vs volumen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExcelFile('netofuel_tanques.xls', [{ title: 'Tanques', rows: tanks }])}
                  className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  Excel
                </button>
              </div>
              <div className="h-[300px]">
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
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispensadores</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Totalizadores</h3>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExcelFile('netofuel_dispensadores.xls', [{ title: 'Dispensadores', rows: dispensers }])}
                  className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  Excel
                </button>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dispenserChart} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
                    <Bar dataKey="totalizador" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Totalizador" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Distribución</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Almacenado, disponible y no conciliado</h3>
            </div>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={fuelDistribution} dataKey="value" innerRadius="58%" outerRadius="84%" paddingAngle={4} cornerRadius={8}>
                      {fuelDistribution.map((item) => <Cell key={item.name} fill={item.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 self-center">
                {fuelDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2 text-sm text-slate-200">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span>
                    <span className="font-semibold text-white">{volume(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

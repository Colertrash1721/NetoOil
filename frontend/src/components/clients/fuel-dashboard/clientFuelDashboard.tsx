'use client';

import {
  FuelDashboardApi,
  getFuelDashboardService,
  getFuelTransactionsService,
  RefuelingTransactionApi,
} from '@/services/fuel/service';
import { useEffect, useMemo, useState } from 'react';
import { DispenserDetail } from './dispenserDetail';
import { buildDemoDispensers, buildDemoTanks } from './demoData';
import { downloadExcelFile, transactionRows } from './export';
import { volume } from './format';
import { DispenserTotalizerChart, FuelDistributionChart, TankCapacityChart } from './charts';
import { KpiCard } from './kpiCard';
import { SelectionPanel } from './selectionPanel';
import { TankDetail } from './tankDetail';

export function ClientFuelDashboard() {
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
        <SelectionPanel
          viewMode={viewMode}
          tanks={tanks}
          dispensers={dispensers}
          selectedTank={selectedTank}
          selectedDispenser={selectedDispenser}
          onViewModeChange={setViewMode}
          onTankSelect={setSelectedTankId}
          onDispenserSelect={setSelectedDispenserId}
        />

        <div className="grid gap-4">
          {viewMode === 'tanks' && selectedTank ? <TankDetail tank={selectedTank} /> : null}
          {viewMode === 'dispensers' && selectedDispenser ? <DispenserDetail dispenser={selectedDispenser} /> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <TankCapacityChart data={tankChart} tanks={tanks} />
            <DispenserTotalizerChart data={dispenserChart} dispensers={dispensers} />
          </div>

          <FuelDistributionChart data={fuelDistribution} />
        </div>
      </section>
    </div>
  );
}

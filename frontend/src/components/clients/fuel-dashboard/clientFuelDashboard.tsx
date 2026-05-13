'use client';

import {
  FuelDashboardApi,
  getFuelDashboardService,
  getFuelTransactionsService,
  RefuelingTransactionApi,
  TankApi,
  TankUpdatePayload,
  updateTankService,
} from '@/services/fuel/service';
import { getApiErrorMessage } from '@/services/api/client';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { DispenserDetail } from './dispenserDetail';
import { downloadExcelFile, transactionRows } from './export';
import { volume } from './format';
import { DispenserTotalizerChart, FuelDistributionChart, TankCapacityChart } from './charts';
import { KpiCard } from './kpiCard';
import { SelectionPanel } from './selectionPanel';
import { TankDetail } from './tankDetail';

type TankEditForm = {
  code: string;
  name: string;
  location: string;
  fuelType: string;
  storageType: string;
  capacity: string;
  currentVolume: string;
  targetRefillGallons: string;
  temperature: string;
  density: string;
  status: string;
  sensorIdentifier: string;
};

function tankToForm(tank: TankApi): TankEditForm {
  return {
    code: tank.code,
    name: tank.name,
    location: tank.location,
    fuelType: tank.fuelType,
    storageType: tank.storageType,
    capacity: String(tank.capacity),
    currentVolume: String(tank.currentVolume),
    targetRefillGallons: tank.targetRefillGallons?.toString() ?? '',
    temperature: tank.temperature?.toString() ?? '',
    density: tank.density?.toString() ?? '',
    status: tank.status,
    sensorIdentifier: tank.sensorIdentifier ?? '',
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ClientFuelDashboard({ canEditTanks = false }: { canEditTanks?: boolean }) {
  const [dashboard, setDashboard] = useState<FuelDashboardApi | null>(null);
  const [transactions, setTransactions] = useState<RefuelingTransactionApi[]>([]);
  const [viewMode, setViewMode] = useState<'tanks' | 'dispensers'>('tanks');
  const [selectedTankId, setSelectedTankId] = useState<number | null>(null);
  const [selectedDispenserId, setSelectedDispenserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTank, setEditingTank] = useState<TankApi | null>(null);
  const [tankForm, setTankForm] = useState<TankEditForm | null>(null);
  const [savingTank, setSavingTank] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const loadDashboard = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [dashboardData, transactionData] = await Promise.all([
        getFuelDashboardService().catch(() => null),
        getFuelTransactionsService(500).catch(() => []),
      ]);
      setDashboard(dashboardData);
      setTransactions(transactionData);
      setSelectedTankId((current) => current ?? dashboardData?.tanks[0]?.id ?? null);
      setSelectedDispenserId((current) => current ?? dashboardData?.dispensers[0]?.id ?? null);
      return dashboardData;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useRealtimeRefresh(['fuel.simulation.updated', 'vehicle.telemetry.updated', 'alert.created'], () => {
    void loadDashboard(false);
  });

  const kpis = dashboard?.kpis;
  const tanks = useMemo(() => dashboard?.tanks ?? [], [dashboard?.tanks]);
  const dispensers = useMemo(() => dashboard?.dispensers ?? [], [dashboard?.dispensers]);
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

  const startTankEdit = (tank: TankApi) => {
    setEditingTank(tank);
    setTankForm(tankToForm(tank));
    setSelectedTankId(tank.id);
    setViewMode('tanks');
    setEditMessage(null);
    setEditError(null);
  };

  const handleTankFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setTankForm((current) => (current ? { ...current, [name]: value } : current));
  };

  const handleTankSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTank || !tankForm) return;

    setSavingTank(true);
    setEditMessage(null);
    setEditError(null);

    try {
      const payload: TankUpdatePayload = {
        code: tankForm.code.trim(),
        name: tankForm.name.trim(),
        location: tankForm.location.trim(),
        fuelType: tankForm.fuelType.trim() || 'diesel',
        storageType: tankForm.storageType,
        capacity: Number(tankForm.capacity),
        currentVolume: Number(tankForm.currentVolume),
        targetRefillGallons: optionalNumber(tankForm.targetRefillGallons),
        temperature: optionalNumber(tankForm.temperature),
        density: optionalNumber(tankForm.density),
        status: tankForm.status,
        sensorIdentifier: optionalString(tankForm.sensorIdentifier),
      };

      if (!payload.code || !payload.name || !payload.location || !payload.capacity || payload.capacity <= 0) {
        throw new Error('Codigo, nombre, ubicacion y capacidad son obligatorios.');
      }

      await updateTankService(editingTank.id, payload);
      const refreshed = await loadDashboard();
      const updatedTank = refreshed?.tanks.find((tank) => tank.id === editingTank.id) ?? null;
      setEditingTank(updatedTank);
      setTankForm(updatedTank ? tankToForm(updatedTank) : null);
      setEditMessage('Tanque actualizado correctamente.');
    } catch (error) {
      setEditError(getApiErrorMessage(error, 'No se pudo actualizar el tanque.'));
    } finally {
      setSavingTank(false);
    }
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
          canEditTanks={canEditTanks}
          onViewModeChange={setViewMode}
          onTankSelect={setSelectedTankId}
          onDispenserSelect={setSelectedDispenserId}
          onTankConfigure={startTankEdit}
        />

        <div className="grid gap-4">
          {canEditTanks && editingTank && tankForm ? (
            <form
              className="rounded-[30px] border border-emerald-300/20 bg-white/95 p-5 text-slate-900 shadow-xl shadow-cyan-950/10"
              onSubmit={handleTankSave}
            >
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Configurar tanque</p>
                  <h3 className="mt-1 text-2xl font-semibold">{editingTank.code}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTank(null);
                    setTankForm(null);
                    setEditMessage(null);
                    setEditError(null);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Cerrar configuracion"
                >
                  <i className="bx bx-x" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Codigo
                  <input name="code" value={tankForm.code} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Nombre
                  <input name="name" value={tankForm.name} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Sensor del tanque
                  <input name="sensorIdentifier" value={tankForm.sensorIdentifier} onChange={handleTankFormChange} placeholder="tank-sensor-001" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Ubicacion
                  <input name="location" value={tankForm.location} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Combustible
                  <input name="fuelType" value={tankForm.fuelType} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Tipo
                  <select name="storageType" value={tankForm.storageType} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400">
                    <option value="aereo">Aereo</option>
                    <option value="soterrado">Soterrado</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Capacidad litros
                  <input name="capacity" type="number" min="1" step="0.01" value={tankForm.capacity} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Volumen actual
                  <input name="currentVolume" type="number" min="0" step="0.01" value={tankForm.currentVolume} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Galones disponibles a echar
                  <input name="targetRefillGallons" type="number" min="0" step="0.01" value={tankForm.targetRefillGallons} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Temperatura
                  <input name="temperature" type="number" step="0.01" value={tankForm.temperature} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Densidad
                  <input name="density" type="number" step="0.001" value={tankForm.density} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Estado
                  <select name="status" value={tankForm.status} onChange={handleTankFormChange} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-emerald-400">
                    <option value="operational">En linea</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="offline">Fuera de linea</option>
                    <option value="alarm">Alarma</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingTank}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <i className="bx bx-save" />
                  {savingTank ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {editMessage ? <span className="text-sm font-medium text-emerald-700">{editMessage}</span> : null}
                {editError ? <span className="text-sm font-medium text-rose-700">{editError}</span> : null}
              </div>
            </form>
          ) : null}

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

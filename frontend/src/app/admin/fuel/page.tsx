'use client';

import { getApiErrorMessage } from '@/services/api/client';
import { FuelDashboardApi, getFuelDashboardService } from '@/services/fuel/service';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const numberFormat = new Intl.NumberFormat('es-DO', {
  maximumFractionDigits: 1,
});

function formatVolume(value: number) {
  return `${numberFormat.format(value)} L`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Sin registro';
  }
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function KpiBox({
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-xl text-cyan-700">
          <i className={`bx ${icon}`} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

export default function FuelManagementPage() {
  const [dashboard, setDashboard] = useState<FuelDashboardApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setDashboard(await getFuelDashboardService());
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'No se pudo cargar gestión de combustible.'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const tankChart = useMemo(() => {
    return (dashboard?.tanks ?? []).map((tank) => ({
      name: tank.code,
      volumen: Number(tank.currentVolume.toFixed(1)),
      capacidad: Number(tank.capacity.toFixed(1)),
      llenado: Number(tank.fillPercent.toFixed(1)),
    }));
  }, [dashboard]);

  const dispenserChart = useMemo(() => {
    return (dashboard?.dispensers ?? []).map((dispenser) => ({
      name: dispenser.code,
      total: Number(dispenser.totalizer.toFixed(1)),
    }));
  }, [dashboard]);

  if (loading) {
    return <div className="rounded-lg bg-white p-6 shadow">Cargando gestión integral de combustible...</div>;
  }

  if (error || !dashboard) {
    return <div className="rounded-lg bg-white p-6 text-red-700 shadow">{error ?? 'Sin datos disponibles.'}</div>;
  }

  const { kpis } = dashboard;

  return (
    <div className="flex min-h-full flex-col gap-4 text-slate-900">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestión integral de combustible</h1>
            <p className="mt-1 text-sm text-slate-600">
              Recepción, almacenamiento, despacho, consumo, políticas, auditoría y conciliación.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-slate-100 px-3 py-2">
              <p className="font-bold">{dashboard.tanks.length}</p>
              <p className="text-slate-500">Tanques</p>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2">
              <p className="font-bold">{dashboard.dispensers.length}</p>
              <p className="text-slate-500">Surtidores</p>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2">
              <p className="font-bold">{dashboard.recentTransactions.length}</p>
              <p className="text-slate-500">Despachos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiBox
          title="Volumen almacenado"
          value={formatVolume(kpis.totalStoredVolume)}
          detail={`${kpis.globalFillPercent.toFixed(1)}% de ${formatVolume(kpis.totalTankCapacity)} global`}
          icon="bx-cylinder"
        />
        <KpiBox
          title="Despachado 30 días"
          value={formatVolume(kpis.volumeDispensed)}
          detail={`${kpis.validTransactions} transacciones válidas`}
          icon="bx-transfer"
        />
        <KpiBox
          title="No conciliado"
          value={formatVolume(kpis.unreconciledFuel)}
          detail={`Consumo estimado ${formatVolume(kpis.estimatedVehicleConsumption)}`}
          icon="bx-git-compare"
        />
        <KpiBox
          title="Pronóstico 7 días"
          value={formatVolume(kpis.forecastNext7Days)}
          detail={`${kpis.onlineDispensers} surtidores online, ${kpis.activeAlerts} alertas abiertas`}
          icon="bx-line-chart"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Almacenamiento por tanque</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tankChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatVolume(Number(value))} />
                <Area dataKey="capacidad" stroke="#94a3b8" fill="#e2e8f0" name="Capacidad" />
                <Area dataKey="volumen" stroke="#0891b2" fill="#67e8f9" name="Volumen" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Totalizadores de surtidores</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispenserChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatVolume(Number(value))} />
                <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} name="Totalizador" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Tanques institucionales</h2>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
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
                {dashboard.tanks.map((tank) => (
                  <tr key={tank.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold">{tank.code}</td>
                    <td className="px-3 py-2">{tank.location}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-cyan-600" style={{ width: `${Math.min(tank.fillPercent, 100)}%` }} />
                        </div>
                        <span>{tank.fillPercent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{tank.temperature?.toFixed(1) ?? '-'} C</td>
                    <td className="px-3 py-2">{tank.density?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{tank.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Transacciones recientes</h2>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Vehículo</th>
                  <th className="px-3 py-2">Chofer</th>
                  <th className="px-3 py-2">Surtidor</th>
                  <th className="px-3 py-2">Volumen</th>
                  <th className="px-3 py-2">Autorización</th>
                  <th className="px-3 py-2">Hora</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold">{transaction.transactionCode}</td>
                    <td className="px-3 py-2">{transaction.vehiclePlate ?? transaction.vehicleId}</td>
                    <td className="px-3 py-2">{transaction.driverName ?? 'Sin chofer'}</td>
                    <td className="px-3 py-2">{transaction.dispenserCode}</td>
                    <td className="px-3 py-2">{formatVolume(transaction.dispensedVolume)}</td>
                    <td className="px-3 py-2">{transaction.preAuthorized ? 'Preautorizada' : 'Manual'}</td>
                    <td className="px-3 py-2">{formatDate(transaction.completedAt ?? transaction.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

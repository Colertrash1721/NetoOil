'use client';

import { getApiErrorMessage } from '@/services/api/client';
import { getFuelOperationalReportService, OperationalTraceabilityReportApi } from '@/services/fuel/service';
import { useEffect, useMemo, useState } from 'react';

const stages: Record<string, string> = {
  recepcion: 'Recepción',
  almacenamiento: 'Almacenamiento',
  expendio: 'Expendio',
  consumo: 'Consumo',
  auditoria: 'Auditoría',
};

function formatDate(value: unknown) {
  if (!value || typeof value !== 'string') {
    return 'Sin fecha';
  }
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function text(value: unknown) {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function AdminTraceabilityPage() {
  const [report, setReport] = useState<OperationalTraceabilityReportApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [days, setDays] = useState('30');

  const filters = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Number(days));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [days]);

  async function loadReport() {
    setLoading(true);
    setErrorMessage(null);
    try {
      setReport(await getFuelOperationalReportService('traceability', filters));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar la trazabilidad.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start, filters.end]);

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Trazabilidad completa</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Recepción, almacenamiento, expendio y consumo</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Evidencia auditada con timestamps, origen, destino, vehículo, operador, volumen, referencia y estado.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
            >
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="365">1 año</option>
            </select>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Eventos</p>
          <p className="mt-2 text-2xl font-semibold">{report?.summary.events ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recepciones</p>
          <p className="mt-2 text-2xl font-semibold">{report?.summary.receipts ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Despachos</p>
          <p className="mt-2 text-2xl font-semibold">{report?.summary.transactions ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Consumos</p>
          <p className="mt-2 text-2xl font-semibold">{report?.summary.consumptionTelemetry ?? 0}</p>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Operación</p>
            <h2 className="text-xl font-semibold text-slate-950">Ejemplo de flujo de evento</h2>
          </div>
          {loading ? <span className="text-sm text-slate-500">Cargando...</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Destino</th>
                <th className="px-3 py-2">Vehículo</th>
                <th className="px-3 py-2">Operario</th>
                <th className="px-3 py-2">Volumen</th>
                <th className="px-3 py-2">Referencia</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(report?.events ?? []).map((event, index) => (
                <tr key={`${text(event.timestamp)}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-2">{formatDate(event.timestamp)}</td>
                  <td className="px-3 py-2 font-semibold">{stages[text(event.stage)] ?? text(event.stage)}</td>
                  <td className="px-3 py-2">{text(event.origin)}</td>
                  <td className="px-3 py-2">{text(event.destination)}</td>
                  <td className="px-3 py-2">{text(event.vehicle)}</td>
                  <td className="px-3 py-2">{text(event.operator)}</td>
                  <td className="px-3 py-2">{text(event.volume)}</td>
                  <td className="px-3 py-2">{text(event.reference)}</td>
                  <td className="px-3 py-2">{text(event.status)}</td>
                </tr>
              ))}
              {!loading && (report?.events.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-slate-500" colSpan={9}>No hay eventos en el rango seleccionado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

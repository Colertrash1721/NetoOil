'use client';

import {
  FuelTransactionFilters,
  getFuelTransactionsService,
  RefuelingTransactionApi,
} from '@/services/fuel/service';
import { useEffect, useMemo, useState } from 'react';

type RangeKey = 'week' | 'month' | 'year' | 'fiveYears';

type TransactionHistoryTableProps = {
  title: string;
  subtitle?: string;
  filters: Pick<FuelTransactionFilters, 'vehicleId' | 'dispenserId' | 'tankId'>;
  variant?: 'dark' | 'light';
  limit?: number;
};

const ranges: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: 'week', label: 'Última semana', days: 7 },
  { key: 'month', label: 'Último mes', days: 31 },
  { key: 'year', label: 'Último año', days: 365 },
  { key: 'fiveYears', label: 'Últimos 5 años', days: 365 * 5 },
];

const numberFormat = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 });

function getRangeStart(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString();
}

function formatVolume(value: number) {
  return `${numberFormat.format(value)} L`;
}

function formatDate(value?: string | null) {
  if (!value) {
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

export function TransactionHistoryTable({
  title,
  subtitle,
  filters,
  variant = 'dark',
  limit = 200,
}: TransactionHistoryTableProps) {
  const [range, setRange] = useState<RangeKey>('week');
  const [transactions, setTransactions] = useState<RefuelingTransactionApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { vehicleId, dispenserId, tankId } = filters;
  const activeRange = ranges.find((item) => item.key === range) ?? ranges[0];
  const totalVolume = useMemo(
    () => transactions.reduce((sum, transaction) => sum + transaction.dispensedVolume, 0),
    [transactions],
  );
  const isDark = variant === 'dark';

  useEffect(() => {
    const load = async () => {
      if (!vehicleId && !dispenserId && !tankId) {
        setTransactions([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getFuelTransactionsService({
          vehicleId,
          dispenserId,
          tankId,
          limit,
          start: getRangeStart(activeRange.days),
          end: new Date().toISOString(),
        });
        setTransactions(data);
      } catch {
        setTransactions([]);
        setError('No se pudieron cargar las transacciones.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeRange.days, dispenserId, limit, tankId, vehicleId]);

  return (
    <article className={isDark ? 'rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm' : 'rounded-lg bg-white p-4 shadow-sm'}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={isDark ? 'text-xs uppercase tracking-[0.3em] text-slate-400' : 'text-xs font-semibold uppercase tracking-wide text-slate-500'}>
            Transacciones
          </p>
          <h3 className={isDark ? 'mt-1 text-xl font-semibold text-white' : 'mt-1 text-lg font-bold text-slate-950'}>{title}</h3>
          {subtitle ? <p className={isDark ? 'mt-1 text-sm text-slate-400' : 'mt-1 text-sm text-slate-600'}>{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={
                range === item.key
                  ? isDark
                    ? 'rounded-full bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950'
                    : 'rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold text-white'
                  : isDark
                    ? 'rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-200/40 hover:text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={isDark ? 'mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2' : 'mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2'}>
        <div className={isDark ? 'rounded-2xl bg-slate-950/35 p-3' : 'rounded-lg bg-slate-50 p-3'}>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Registros</p>
          <p className={isDark ? 'mt-1 text-lg font-semibold text-white' : 'mt-1 text-lg font-bold text-slate-950'}>{transactions.length}</p>
        </div>
        <div className={isDark ? 'rounded-2xl bg-slate-950/35 p-3' : 'rounded-lg bg-slate-50 p-3'}>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Volumen</p>
          <p className={isDark ? 'mt-1 text-lg font-semibold text-white' : 'mt-1 text-lg font-bold text-slate-950'}>{formatVolume(totalVolume)}</p>
        </div>
      </div>

      <div className="mt-4 max-h-80 overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className={isDark ? 'sticky top-0 bg-slate-950 text-xs uppercase text-slate-400' : 'sticky top-0 bg-slate-100 text-xs uppercase text-slate-600'}>
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Vehículo</th>
              <th className="px-3 py-2">Chofer</th>
              <th className="px-3 py-2">Dispensador</th>
              <th className="px-3 py-2">Tanque</th>
              <th className="px-3 py-2">Volumen</th>
              <th className="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {loading ? (
              <tr>
                <td className="px-3 py-4" colSpan={7}>Cargando transacciones...</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-3 py-4 text-rose-400" colSpan={7}>{error}</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td className="px-3 py-4" colSpan={7}>No hay transacciones en este rango.</td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className={isDark ? 'border-b border-white/10' : 'border-b border-slate-100'}>
                  <td className={isDark ? 'px-3 py-2 font-semibold text-white' : 'px-3 py-2 font-semibold text-slate-950'}>{transaction.transactionCode}</td>
                  <td className="px-3 py-2">{transaction.vehiclePlate ?? transaction.vehicleId}</td>
                  <td className="px-3 py-2">{transaction.driverName ?? 'Sin chofer'}</td>
                  <td className="px-3 py-2">{transaction.dispenserCode ?? transaction.dispenserId}</td>
                  <td className="px-3 py-2">{transaction.tankCode ?? transaction.tankId}</td>
                  <td className="px-3 py-2">{formatVolume(transaction.dispensedVolume)}</td>
                  <td className="px-3 py-2">{formatDate(transaction.completedAt ?? transaction.startedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

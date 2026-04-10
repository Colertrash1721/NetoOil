'use client';

import { useBusContext } from '@/hooks/client/provider';
import { formatRelativeHour, getBusTone, getFuelDelta, getLatestDiesel } from '@/hooks/client/vehicleUi';
import { useDeferredValue, useMemo, useState } from 'react';

type NavClientProps = {
  navOpen: boolean;
  onClose: () => void;
};

export default function NavClient({ navOpen, onClose }: NavClientProps) {
  const { buses, busSelected, setBusSelected, loading } = useBusContext();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filteredBuses = useMemo(() => {
    const value = deferredQuery.trim().toLowerCase();
    if (!value) {
      return buses;
    }
    return buses.filter((bus) => {
      return [bus.name, bus.plate, bus.route, bus.driver].some((item) => item.toLowerCase().includes(value));
    });
  }, [buses, deferredQuery]);

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm transition lg:hidden ${navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[88vw] max-w-[340px] border-r border-white/10 bg-[#071521]/95 p-4 shadow-2xl backdrop-blur-xl transition duration-300 lg:static lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-[28px] lg:border lg:bg-white/5',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/60">Fleet</p>
              <h2 className="text-2xl font-semibold text-white">Vehículos</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-slate-100 lg:hidden"
            >
              <i className='bx bx-x'></i>
            </button>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
              <i className='bx bx-search text-lg text-slate-400'></i>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por placa, ruta o chofer"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
              <span>{loading ? 'Sincronizando...' : `${filteredBuses.length} unidades visibles`}</span>
              <span>base de datos</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {!loading && filteredBuses.length === 0 && (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No hay vehiculos registrados en la base de datos.
              </div>
            )}
            {filteredBuses.map((bus) => {
              const isSelected = busSelected?.plate === bus.plate;
              const tone = getBusTone(bus);
              const currentFuel = getLatestDiesel(bus);
              const delta = getFuelDelta(bus);

              return (
                <button
                  key={bus.id}
                  type="button"
                  onClick={() => {
                    setBusSelected(bus);
                    onClose();
                  }}
                  className={[
                    'group w-full rounded-[26px] border p-4 text-left transition',
                    isSelected
                      ? 'border-cyan-300/30 bg-white/12 shadow-lg shadow-cyan-950/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/8',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{bus.name}</p>
                      <p className="text-sm text-slate-400">{bus.route}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                      {bus.status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone.accent} text-2xl text-slate-950 shadow-lg`}>
                      <i className='bx bx-bus'></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{bus.plate}</span>
                        <span>{currentFuel.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${tone.accent}`}
                          style={{ width: `${Math.min(100, Math.max(8, currentFuel))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Error modelo</p>
                      <p className="mt-1 font-semibold text-white">{delta.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Última lectura</p>
                      <p className="mt-1 font-semibold text-white">{formatRelativeHour(bus.telemetry.updatedAt)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}

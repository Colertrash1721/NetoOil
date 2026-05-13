'use client';

import { useBusContext } from '@/hooks/client/provider';
import { formatRelativeHour, getBusTone, getFuelDelta, getLatestDiesel } from '@/hooks/client/vehicleUi';
import { getApiErrorMessage } from '@/services/api/client';
import {
  getVehicleDetailService,
  updateVehicleService,
  VehicleDetailApi,
  VehicleUpdatePayload,
} from '@/services/vehicles/service';
import { BusItem } from '@/types/buses';
import { ChangeEvent, FormEvent, MouseEvent, useDeferredValue, useMemo, useState } from 'react';

type NavClientProps = {
  navOpen: boolean;
  onClose: () => void;
  canConfigureVehicles?: boolean;
};

type VehicleConfigForm = {
  brand: string;
  model: string;
  plate: string;
  sensorIdentifier: string;
  tankCapacity: string;
  fuelConsumption: string;
  targetRefillGallons: string;
  status: string;
};

function vehicleToForm(vehicle: VehicleDetailApi | BusItem): VehicleConfigForm {
  return {
    brand: vehicle.brand ?? '',
    model: vehicle.model ?? '',
    plate: vehicle.plate,
    sensorIdentifier: vehicle.sensorIdentifier ?? '',
    tankCapacity: vehicle.tankCapacity ?? '',
    fuelConsumption: vehicle.fuelConsumption ?? '',
    targetRefillGallons: vehicle.targetRefillGallons?.toString() ?? '',
    status: 'rawStatus' in vehicle ? vehicle.rawStatus ?? 'active' : vehicle.status ?? 'active',
  };
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

export default function NavClient({ navOpen, onClose, canConfigureVehicles = false }: NavClientProps) {
  const { buses, busSelected, setBusSelected, loading, refreshFleet } = useBusContext();
  const [query, setQuery] = useState('');
  const [configVehicle, setConfigVehicle] = useState<BusItem | null>(null);
  const [configForm, setConfigForm] = useState<VehicleConfigForm | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const showVehicleConfig = canConfigureVehicles;

  const filteredBuses = useMemo(() => {
    const value = deferredQuery.trim().toLowerCase();
    if (!value) {
      return buses;
    }
    return buses.filter((bus) => {
      return [bus.name, bus.plate, bus.route, bus.driver].some((item) => item.toLowerCase().includes(value));
    });
  }, [buses, deferredQuery]);

  const closeConfig = () => {
    setConfigVehicle(null);
    setConfigForm(null);
    setConfigError(null);
    setConfigMessage(null);
  };

  const openConfig = async (event: MouseEvent<HTMLButtonElement>, bus: BusItem) => {
    event.stopPropagation();
    setConfigVehicle(bus);
    setConfigForm(vehicleToForm(bus));
    setConfigError(null);
    setConfigMessage(null);

    try {
      const detail = await getVehicleDetailService(bus.id);
      setConfigForm(vehicleToForm(detail));
    } catch (error) {
      setConfigError(getApiErrorMessage(error, 'No se pudieron cargar los datos del vehiculo.'));
    }
  };

  const handleConfigChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setConfigForm((current) => (current ? { ...current, [name]: value } : current));
  };

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configVehicle || !configForm) return;

    setSavingConfig(true);
    setConfigError(null);
    setConfigMessage(null);

    try {
      const payload: VehicleUpdatePayload = {
        brand: configForm.brand.trim(),
        model: configForm.model.trim(),
        plate: configForm.plate.trim(),
        sensorIdentifier: optionalString(configForm.sensorIdentifier),
        tankCapacity: optionalString(configForm.tankCapacity),
        fuelConsumption: optionalString(configForm.fuelConsumption),
        targetRefillGallons: optionalNumber(configForm.targetRefillGallons),
        status: configForm.status,
      };

      if (!payload.brand || !payload.model || !payload.plate) {
        throw new Error('Marca, modelo y placa son obligatorios.');
      }

      await updateVehicleService(configVehicle.id, payload);
      await refreshFleet();
      setConfigMessage('Vehiculo actualizado correctamente.');
    } catch (error) {
      setConfigError(getApiErrorMessage(error, 'No se pudo actualizar el vehiculo.'));
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm transition lg:hidden ${navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[88vw] max-w-[340px] overflow-hidden border-r border-white/10 bg-[#071521]/95 p-4 shadow-2xl backdrop-blur-xl transition duration-300 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-[28px] lg:border lg:bg-white/5',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
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
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-slate-300">
                base de datos
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
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
                <div
                  key={bus.id}
                  onClick={() => {
                    setBusSelected(bus);
                    onClose();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setBusSelected(bus);
                      onClose();
                    }
                  }}
                  className={[
                    'group w-full cursor-pointer rounded-[26px] border p-4 text-left transition',
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
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {bus.status}
                      </span>
                      {showVehicleConfig ? (
                        <button
                          type="button"
                          onClick={(event) => void openConfig(event, bus)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-lg text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 hover:text-cyan-100"
                          title="Configurar vehiculo"
                          aria-label={`Configurar ${bus.name}`}
                        >
                          <i className="bx bx-cog" />
                        </button>
                      ) : null}
                    </div>
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
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {configVehicle && configForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:items-center">
          <form
            onSubmit={saveConfig}
            className="w-full max-w-2xl rounded-[28px] border border-white/12 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Configuracion</p>
                <h3 className="mt-1 text-2xl font-semibold">{configVehicle.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{configVehicle.plate}</p>
              </div>
              <button
                type="button"
                onClick={closeConfig}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-slate-200 transition hover:bg-white/10"
                aria-label="Cerrar configuracion"
              >
                <i className="bx bx-x" />
              </button>
            </div>

            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Nombre / marca
                <input name="brand" value={configForm.brand} onChange={handleConfigChange} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Numero / modelo
                <input name="model" value={configForm.model} onChange={handleConfigChange} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Placa
                <input name="plate" value={configForm.plate} onChange={handleConfigChange} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Dispositivo sensor
                <input name="sensorIdentifier" value={configForm.sensorIdentifier} onChange={handleConfigChange} placeholder="sensor-001" className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Galones disponibles a echar
                <input name="targetRefillGallons" type="number" min="0" step="0.01" value={configForm.targetRefillGallons} onChange={handleConfigChange} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Capacidad del tanque
                <input name="tankCapacity" value={configForm.tankCapacity} onChange={handleConfigChange} placeholder="90 gal" className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Consumo
                <input name="fuelConsumption" value={configForm.fuelConsumption} onChange={handleConfigChange} placeholder="8.5 gal/km" className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Estado
                <select name="status" value={configForm.status} onChange={handleConfigChange} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 outline-none focus:border-cyan-300/50">
                  <option value="active">En ruta</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="offline">Fuera de linea</option>
                  <option value="alert">Alerta</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                <i className="bx bx-save" />
                {savingConfig ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={closeConfig}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
              >
                Cancelar
              </button>
              {configMessage ? <span className="text-sm font-semibold text-emerald-200">{configMessage}</span> : null}
              {configError ? <span className="text-sm font-semibold text-rose-200">{configError}</span> : null}
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

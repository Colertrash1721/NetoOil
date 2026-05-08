'use client';

import { getApiErrorMessage } from '@/services/api/client';
import {
  DispenserApi,
  getDispensersService,
  getTanksService,
  simulateFuelDeviceService,
  TankApi,
  FuelSimulationResultApi,
} from '@/services/fuel/service';
import { getVehiclesService, VehicleApi } from '@/services/vehicles/service';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type DeviceType = 'vehicle' | 'tank' | 'dispenser';
type Operation = 'fill' | 'drain';

const GALLON_TO_LITER = 3.785411784;

function litersToGallons(value?: number | null) {
  return (value ?? 0) / GALLON_TO_LITER;
}

function formatGallons(value?: number | null) {
  if (value == null) {
    return 'N/D';
  }
  return `${value.toLocaleString('es-DO', { maximumFractionDigits: 2 })} gal`;
}

function parseCapacityGallons(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(',', '.');
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return normalized.includes('l') || normalized.includes('litro') ? parsed / GALLON_TO_LITER : parsed;
}

export default function AdminSimulationPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleApi[]>([]);
  const [tanks, setTanks] = useState<TankApi[]>([]);
  const [dispensers, setDispensers] = useState<DispenserApi[]>([]);
  const [deviceType, setDeviceType] = useState<DeviceType>('vehicle');
  const [deviceId, setDeviceId] = useState('');
  const [operation, setOperation] = useState<Operation>('fill');
  const [gallons, setGallons] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FuelSimulationResultApi | null>(null);

  useEffect(() => {
    if (localStorage.getItem('rol') !== 'superadmin') {
      router.replace('/admin');
      return;
    }
    setAllowed(true);
  }, [router]);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [vehicleData, tankData, dispenserData] = await Promise.all([
          getVehiclesService(),
          getTanksService(),
          getDispensersService(),
        ]);
        setVehicles(vehicleData);
        setTanks(tankData);
        setDispensers(dispenserData);
        setDeviceId(String(vehicleData[0]?.id ?? ''));
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar los dispositivos.'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [allowed]);

  const deviceOptions = useMemo(() => {
    if (deviceType === 'vehicle') {
      return vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`,
        limit: vehicle.targetRefillGallons,
        current: litersToGallons(vehicle.lastVolume),
        capacity: parseCapacityGallons(vehicle.tankCapacity),
      }));
    }
    if (deviceType === 'tank') {
      return tanks.map((tank) => ({
        id: tank.id,
        label: `${tank.code} · ${tank.location}`,
        limit: tank.targetRefillGallons,
        current: litersToGallons(tank.currentVolume),
        capacity: litersToGallons(tank.capacity),
      }));
    }
    return dispensers.map((dispenser) => ({
      id: dispenser.id,
      label: `${dispenser.code} · ${dispenser.location}`,
      limit: dispenser.targetRefillGallons,
      current: litersToGallons(dispenser.totalizer),
      capacity: null,
    }));
  }, [deviceType, dispensers, tanks, vehicles]);

  const selectedDevice = deviceOptions.find((device) => String(device.id) === deviceId) ?? deviceOptions[0] ?? null;

  useEffect(() => {
    setDeviceId(String(deviceOptions[0]?.id ?? ''));
    setGallons(deviceOptions[0]?.limit != null ? String(deviceOptions[0].limit) : '');
  }, [deviceOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);
    const parsedGallons = Number(gallons);
    const parsedDeviceId = Number(deviceId);
    if (!parsedDeviceId || !Number.isFinite(parsedGallons) || parsedGallons <= 0) {
      setErrorMessage('Selecciona un dispositivo y una cantidad de galones mayor que cero.');
      return;
    }

    setRunning(true);
    try {
      const response = await simulateFuelDeviceService({
        deviceType,
        deviceId: parsedDeviceId,
        operation,
        gallons: parsedGallons,
      });
      setResult(response);
      const [vehicleData, tankData, dispenserData] = await Promise.all([
        getVehiclesService(),
        getTanksService(),
        getDispensersService(),
      ]);
      setVehicles(vehicleData);
      setTanks(tankData);
      setDispensers(dispenserData);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo ejecutar la simulación.'));
    } finally {
      setRunning(false);
    }
  }

  if (!allowed || loading) {
    return <div className="rounded-lg bg-white p-6 shadow">Cargando simulador root...</div>;
  }

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Root</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Simulación de llenado y vaciado</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Ejecuta pruebas controladas en galones. El backend corta por límite configurado o por capacidad y genera alertas cuando la operación no se completa.
            </p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            Acceso exclusivo superadmin
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form className="rounded-lg bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Tipo de dispositivo
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'vehicle', label: 'Vehículo', icon: 'bx-car' },
                  { key: 'tank', label: 'Tanque', icon: 'bx-cylinder' },
                  { key: 'dispenser', label: 'Dispensador', icon: 'bx-gas-pump' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDeviceType(item.key as DeviceType)}
                    className={
                      deviceType === item.key
                        ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-3 text-sm font-semibold text-white'
                        : 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700'
                    }
                  >
                    <i className={`bx ${item.icon} text-lg`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              Dispositivo
              <select
                value={deviceId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setDeviceId(nextId);
                  const nextDevice = deviceOptions.find((device) => String(device.id) === nextId);
                  setGallons(nextDevice?.limit != null ? String(nextDevice.limit) : '');
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-cyan-400"
              >
                {deviceOptions.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              Operación
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOperation('fill')}
                  className={operation === 'fill' ? 'rounded-lg bg-emerald-600 px-4 py-3 text-white' : 'rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600'}
                >
                  <i className="bx bx-up-arrow-alt mr-2" />
                  Llenar
                </button>
                <button
                  type="button"
                  onClick={() => setOperation('drain')}
                  className={operation === 'drain' ? 'rounded-lg bg-amber-600 px-4 py-3 text-white' : 'rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600'}
                >
                  <i className="bx bx-down-arrow-alt mr-2" />
                  Vaciar
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              Galones solicitados
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={gallons}
                onChange={(event) => setGallons(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-cyan-400"
                placeholder="Ej. 25"
              />
            </label>

            <button
              type="submit"
              disabled={running || deviceOptions.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <i className="bx bx-play-circle text-lg" />
              {running ? 'Simulando...' : 'Ejecutar simulación'}
            </button>
          </div>
        </form>

        <div className="grid gap-5">
          <article className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Dispositivo seleccionado</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedDevice?.label ?? 'Sin dispositivo'}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Actual</p>
                <p className="mt-2 text-xl font-semibold">{formatGallons(selectedDevice?.current)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Límite configurado</p>
                <p className="mt-2 text-xl font-semibold">{formatGallons(selectedDevice?.limit)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Capacidad</p>
                <p className="mt-2 text-xl font-semibold">{formatGallons(selectedDevice?.capacity)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Resultado</p>
            {result ? (
              <div className="mt-4 grid gap-3">
                <div className={result.status === 'completed' ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800' : 'rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800'}>
                  <p className="font-semibold">{result.status === 'completed' ? 'Operación completada' : 'Operación cortada'}</p>
                  <p className="mt-1 text-sm">
                    Aplicado {formatGallons(result.appliedGallons)} de {formatGallons(result.requestedGallons)}.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Antes</p>
                    <p className="mt-2 text-lg font-semibold">{formatGallons(result.beforeGallons)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Después</p>
                    <p className="mt-2 text-lg font-semibold">{formatGallons(result.afterGallons)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Cortado</p>
                    <p className="mt-2 text-lg font-semibold">{formatGallons(result.cutGallons)}</p>
                  </div>
                </div>
                {result.messages.length > 0 ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {result.messages.map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                    {result.alertIds.length > 0 ? <p className="mt-2 font-semibold">Alertas creadas: {result.alertIds.join(', ')}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Ejecuta una simulación para ver el corte aplicado y las alertas generadas.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

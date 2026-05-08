'use client';

import { getApiErrorMessage } from '@/services/api/client';
import {
  getDeviceDemoStatusService,
  replayOfflineSensorEventsService,
  simulateWirelessSensorEventService,
  DeviceDemoResultApi,
} from '@/services/fuel/service';
import { getVehiclesService, VehicleApi } from '@/services/vehicles/service';
import { FormEvent, useEffect, useState } from 'react';

type SensorRow = Awaited<ReturnType<typeof getDeviceDemoStatusService>>['sensors'][number];

export default function DeviceDemoPage() {
  const [vehicles, setVehicles] = useState<VehicleApi[]>([]);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [sensorIdentifier, setSensorIdentifier] = useState('BLE-DEMO-001');
  const [vehicleId, setVehicleId] = useState('');
  const [batteryLevel, setBatteryLevel] = useState('87');
  const [tamperDetected, setTamperDetected] = useState(false);
  const [result, setResult] = useState<DeviceDemoResultApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [vehicleData, statusData] = await Promise.all([
        getVehiclesService(),
        getDeviceDemoStatusService(),
      ]);
      setVehicles(vehicleData);
      setSensors(statusData.sensors);
      setVehicleId((current) => current || String(vehicleData[0]?.id ?? ''));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar estado de dispositivos demo.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleWirelessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const response = await simulateWirelessSensorEventService({
        sensorIdentifier,
        vehicleId: Number(vehicleId) || null,
        batteryLevel: Number(batteryLevel),
        tamperDetected,
        remoteConfig: { frequencySeconds: 30, radarAntiTheft: true, source: 'demo' },
      });
      setResult(response);
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo simular el sensor inalámbrico.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleOfflineReplay() {
    setSaving(true);
    setErrorMessage(null);
    setResult(null);
    const now = Date.now();
    try {
      const response = await replayOfflineSensorEventsService({
        events: [3, 2, 1].map((sequence) => ({
          sensorIdentifier,
          vehicleId: Number(vehicleId) || null,
          sequence,
          originalTimestamp: new Date(now - sequence * 60_000).toISOString(),
          batteryLevel: Number(batteryLevel),
          payload: { cached: true, note: 'offline demo' },
        })),
      });
      setResult(response);
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo reproducir la cola offline.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Demo lógico</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Identificación, sensores e intermitencia</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Evidencia sin hardware físico para RFID/MIFARE/ANPR/BLE, sensor inalámbrico, manipulación y reenvío offline con timestamps originales.
        </p>
      </section>

      {errorMessage ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
      {result ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Estado: {result.status}. Procesados: {result.processed}. Alertas: {result.alertIds.join(', ') || '0'}.
          {result.messages.length ? <p className="mt-1">{result.messages[0]}</p> : null}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form className="rounded-lg bg-white p-5 shadow-sm" onSubmit={handleWirelessSubmit}>
          <h2 className="text-xl font-semibold text-slate-950">Sensor BLE vehicular</h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Sensor
              <input
                value={sensorIdentifier}
                onChange={(event) => setSensorIdentifier(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Vehículo emparejado
              <select
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} · {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Batería %
              <input
                type="number"
                min="0"
                max="100"
                value={batteryLevel}
                onChange={(event) => setBatteryLevel(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={tamperDetected}
                onChange={(event) => setTamperDetected(event.target.checked)}
              />
              Simular manipulación / radar anti-robo
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                Registrar evento
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleOfflineReplay()}
                className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                Offline → reconexión
              </button>
            </div>
          </div>
        </form>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-950">Panel de sensores</h2>
            {loading ? <span className="text-sm text-slate-500">Cargando...</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Sensor</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Vehículo</th>
                  <th className="px-3 py-2">Emparejamiento</th>
                  <th className="px-3 py-2">Batería</th>
                  <th className="px-3 py-2">Manipulación</th>
                  <th className="px-3 py-2">Cache</th>
                  <th className="px-3 py-2">Último enlace</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((sensor) => (
                  <tr key={sensor.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold">{sensor.identifier}</td>
                    <td className="px-3 py-2">{sensor.sensorType}</td>
                    <td className="px-3 py-2">{sensor.pairedVehicleId ?? '-'}</td>
                    <td className="px-3 py-2">{sensor.pairingStatus}</td>
                    <td className="px-3 py-2">{sensor.batteryLevel ?? '-'}%</td>
                    <td className="px-3 py-2">{sensor.tamperStatus}</td>
                    <td className="px-3 py-2">{sensor.cachedEvents}</td>
                    <td className="px-3 py-2">{new Date(sensor.lastSeenAt).toLocaleString('es-DO')}</td>
                  </tr>
                ))}
                {!loading && sensors.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-slate-500" colSpan={8}>No hay sensores demo registrados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

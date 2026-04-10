'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/services/api/client';
import { CompanyApi, getCompaniesService } from '@/services/companies/service';
import {
  createVehicleService,
  getVehiclesService,
  updateVehicleService,
  VehicleApi,
  VehicleCreatePayload,
} from '@/services/vehicles/service';

type VehicleFormState = {
  assignedCompanyId: string;
  plate: string;
  seatCount: string;
  brand: string;
  model: string;
  year: string;
  version: string;
  vin: string;
  engineType: string;
  engineDisplacement: string;
  engineCylinderCount: string;
  maxPower: string;
  maxTorque: string;
  fuelConsumption: string;
  tankCapacity: string;
  transmission: string;
  sensorIdentifier: string;
};

const initialFormState: VehicleFormState = {
  assignedCompanyId: '',
  plate: '',
  seatCount: '',
  brand: '',
  model: '',
  year: '',
  version: '',
  vin: '',
  engineType: '',
  engineDisplacement: '',
  engineCylinderCount: '',
  maxPower: '',
  maxTorque: '',
  fuelConsumption: '',
  tankCapacity: '',
  transmission: '',
  sensorIdentifier: '',
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function FleetManager() {
  const [companies, setCompanies] = useState<CompanyApi[]>([]);
  const [vehicles, setVehicles] = useState<VehicleApi[]>([]);
  const [sensorDrafts, setSensorDrafts] = useState<Record<number, string>>({});
  const [form, setForm] = useState<VehicleFormState>(initialFormState);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadFleetData() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [companyData, vehicleData] = await Promise.all([
        getCompaniesService(),
        getVehiclesService(),
      ]);

      setCompanies(companyData);
      setVehicles(vehicleData);
      setSensorDrafts(
        Object.fromEntries(
          vehicleData.map((vehicle) => [vehicle.id, vehicle.sensorIdentifier ?? '']),
        ),
      );

      if (!form.assignedCompanyId && companyData.length > 0) {
        setForm((current) => ({
          ...current,
          assignedCompanyId: String(companyData[0].id),
        }));
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar empresas y vehiculos.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFleetData();
  }, []);

  function handleFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: VehicleCreatePayload = {
        assignedCompanyId: Number(form.assignedCompanyId),
        plate: form.plate.trim(),
        seatCount: toOptionalNumber(form.seatCount),
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: toOptionalNumber(form.year),
        version: toOptionalString(form.version),
        vin: toOptionalString(form.vin),
        engineType: toOptionalString(form.engineType),
        engineDisplacement: toOptionalString(form.engineDisplacement),
        engineCylinderCount: toOptionalNumber(form.engineCylinderCount),
        maxPower: toOptionalString(form.maxPower),
        maxTorque: toOptionalString(form.maxTorque),
        fuelConsumption: toOptionalString(form.fuelConsumption),
        tankCapacity: toOptionalString(form.tankCapacity),
        transmission: toOptionalString(form.transmission),
        sensorIdentifier: toOptionalString(form.sensorIdentifier),
        status: 'active',
      };

      if (!payload.assignedCompanyId || !payload.plate || !payload.brand || !payload.model) {
        throw new Error('Empresa, placa, marca y modelo son obligatorios.');
      }

      await createVehicleService(payload);
      setSuccessMessage('Vehiculo creado correctamente.');
      setForm({
        ...initialFormState,
        assignedCompanyId: companies[0] ? String(companies[0].id) : '',
      });
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el vehiculo.'));
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignSensor(vehicleId: number) {
    setAssigningId(vehicleId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateVehicleService(vehicleId, {
        sensorIdentifier: toOptionalString(sensorDrafts[vehicleId] ?? ''),
      });
      setSuccessMessage('Sensor asignado correctamente.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo asignar el sensor.'));
    } finally {
      setAssigningId(null);
    }
  }

  function getCompanyName(companyId: number) {
    return companies.find((company) => company.id === companyId)?.name ?? `Empresa ${companyId}`;
  }

  return (
    <div className="flex flex-col gap-6 text-slate-900 font-quicksand">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/30">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600">
                Nuevo vehiculo
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Registro de flota y motor
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Crea la unidad y deja listo su identificador de sensor para enlazarla con la telemetria.
              </p>
            </div>
            <div className="rounded-3xl bg-sky-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-700">Flota activa</p>
              <p className="text-3xl font-semibold text-slate-900">{vehicles.length}</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateVehicle}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Empresa
              <select
                name="assignedCompanyId"
                value={form.assignedCompanyId}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Placa
              <input
                name="plate"
                value={form.plate}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="A123456"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Marca
              <input
                name="brand"
                value={form.brand}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="Toyota"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Modelo
              <input
                name="model"
                value={form.model}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="Coaster"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Ano
              <input
                name="year"
                type="number"
                value={form.year}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="2024"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Version
              <input
                name="version"
                value={form.version}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="2.8 GL"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              VIN
              <input
                name="vin"
                value={form.vin}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="JTDBR32E720059651"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Asientos
              <input
                name="seatCount"
                type="number"
                value={form.seatCount}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="32"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Tipo de motor
              <input
                name="engineType"
                value={form.engineType}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="Diesel turbo"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Cilindrada
              <input
                name="engineDisplacement"
                value={form.engineDisplacement}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="2800 cc"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Numero de cilindros
              <input
                name="engineCylinderCount"
                type="number"
                value={form.engineCylinderCount}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="4"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Potencia maxima
              <input
                name="maxPower"
                value={form.maxPower}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="150 HP"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Torque maximo
              <input
                name="maxTorque"
                value={form.maxTorque}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="400 Nm"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Consumo de combustible
              <input
                name="fuelConsumption"
                value={form.fuelConsumption}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="11 km/l"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Capacidad del tanque
              <input
                name="tankCapacity"
                value={form.tankCapacity}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="95 L"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Transmision
              <input
                name="transmission"
                value={form.transmission}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="Manual 6 velocidades"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
              Sensor inicial
              <input
                name="sensorIdentifier"
                value={form.sensorIdentifier}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
                placeholder="cpm212-adv-001"
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creating || companies.length === 0}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creating ? 'Guardando...' : 'Crear vehiculo'}
              </button>
              {companies.length === 0 && !loading ? (
                <span className="text-sm text-amber-700">
                  No hay empresas disponibles para asignar.
                </span>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="border-0 bg-slate-950 text-white shadow-xl shadow-slate-900/20">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Asignacion de sensores
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Enlace rapido sensor-vehiculo</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Edita el identificador del sensor desde aqui. El backend valida que no se repita entre
            vehiculos.
          </p>

          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-300">Cargando flota...</p>
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-slate-300">Todavia no hay vehiculos registrados.</p>
            ) : (
              vehicles.slice(0, 5).map((vehicle) => (
                <div key={vehicle.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {vehicle.plate} · {getCompanyName(vehicle.assignedCompanyId)}
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                      {vehicle.sensorIdentifier || 'Sin sensor'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={sensorDrafts[vehicle.id] ?? ''}
                      onChange={(event) =>
                        setSensorDrafts((current) => ({
                          ...current,
                          [vehicle.id]: event.target.value,
                        }))
                      }
                      className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                      placeholder="Identificador del sensor"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAssignSensor(vehicle.id)}
                      disabled={assigningId === vehicle.id}
                      className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-500"
                    >
                      {assigningId === vehicle.id ? 'Guardando...' : 'Asignar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600">
              Vehiculos registrados
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Inventario de unidades</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadFleetData()}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
          >
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2 font-medium">Vehiculo</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium">Motor</th>
                <th className="px-3 py-2 font-medium">Asientos</th>
                <th className="px-3 py-2 font-medium">VIN</th>
                <th className="px-3 py-2 font-medium">Sensor</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="rounded-2xl bg-slate-50 text-slate-700">
                  <td className="rounded-l-2xl px-3 py-4">
                    <p className="font-semibold text-slate-900">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {vehicle.plate} · {vehicle.year ?? 'S/A'} · {vehicle.version ?? 'Sin version'}
                    </p>
                  </td>
                  <td className="px-3 py-4">{getCompanyName(vehicle.assignedCompanyId)}</td>
                  <td className="px-3 py-4">
                    {[vehicle.engineType, vehicle.engineDisplacement, vehicle.maxPower]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos'}
                  </td>
                  <td className="px-3 py-4">{vehicle.seatCount ?? 'N/D'}</td>
                  <td className="px-3 py-4">{vehicle.vin ?? 'N/D'}</td>
                  <td className="rounded-r-2xl px-3 py-4">{vehicle.sensorIdentifier ?? 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

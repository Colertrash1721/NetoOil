'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/services/api/client';
import { CompanyApi, getCompaniesService } from '@/services/companies/service';
import {
  createDispenserService,
  createDriverService,
  createTankService,
  deleteDispenserService,
  deleteTankService,
  DispenserApi,
  DispenserCreatePayload,
  DriverApi,
  DriverCreatePayload,
  getDispensersService,
  getDriversService,
  getTanksService,
  TankApi,
  TankCreatePayload,
  updateDispenserService,
  updateTankService,
} from '@/services/fuel/service';
import {
  createVehicleService,
  deleteVehicleService,
  getVehiclesService,
  updateVehicleService,
  VehicleApi,
  VehicleCreatePayload,
} from '@/services/vehicles/service';

type VehicleFormState = {
  assignedCompanyId: string;
  assignedDriverId: string;
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

type DriverFormState = {
  assignedCompanyId: string;
  fullName: string;
  documentId: string;
  licenseNumber: string;
  phone: string;
};

type TankFormState = {
  assignedCompanyId: string;
  code: string;
  name: string;
  location: string;
  fuelType: string;
  capacity: string;
  currentVolume: string;
  temperature: string;
  density: string;
  sensorIdentifier: string;
};

type DispenserFormState = {
  assignedCompanyId: string;
  tankId: string;
  code: string;
  name: string;
  location: string;
  totalizer: string;
  deviceIdentifier: string;
};

const initialFormState: VehicleFormState = {
  assignedCompanyId: '',
  assignedDriverId: '',
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

const initialDriverFormState: DriverFormState = {
  assignedCompanyId: '',
  fullName: '',
  documentId: '',
  licenseNumber: '',
  phone: '',
};

const initialTankFormState: TankFormState = {
  assignedCompanyId: '',
  code: '',
  name: '',
  location: '',
  fuelType: 'diesel',
  capacity: '',
  currentVolume: '',
  temperature: '',
  density: '',
  sensorIdentifier: '',
};

const initialDispenserFormState: DispenserFormState = {
  assignedCompanyId: '',
  tankId: '',
  code: '',
  name: '',
  location: '',
  totalizer: '0',
  deviceIdentifier: '',
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
  const [tanks, setTanks] = useState<TankApi[]>([]);
  const [dispensers, setDispensers] = useState<DispenserApi[]>([]);
  const [drivers, setDrivers] = useState<DriverApi[]>([]);
  const [sensorDrafts, setSensorDrafts] = useState<Record<number, string>>({});
  const [form, setForm] = useState<VehicleFormState>(initialFormState);
  const [driverForm, setDriverForm] = useState<DriverFormState>(initialDriverFormState);
  const [tankForm, setTankForm] = useState<TankFormState>(initialTankFormState);
  const [dispenserForm, setDispenserForm] = useState<DispenserFormState>(initialDispenserFormState);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [creatingTank, setCreatingTank] = useState(false);
  const [creatingDispenser, setCreatingDispenser] = useState(false);
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
      const [tankData, dispenserData, driverData] = await Promise.all([
        getTanksService().catch(() => []),
        getDispensersService().catch(() => []),
        getDriversService().catch(() => []),
      ]);

      setCompanies(companyData);
      setVehicles(vehicleData);
      setTanks(tankData);
      setDispensers(dispenserData);
      setDrivers(driverData);
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
      if (!driverForm.assignedCompanyId && companyData.length > 0) {
        setDriverForm((current) => ({
          ...current,
          assignedCompanyId: String(companyData[0].id),
        }));
      }
      if (!tankForm.assignedCompanyId && companyData.length > 0) {
        setTankForm((current) => ({
          ...current,
          assignedCompanyId: String(companyData[0].id),
        }));
      }
      if (!dispenserForm.assignedCompanyId && companyData.length > 0) {
        setDispenserForm((current) => ({
          ...current,
          assignedCompanyId: String(companyData[0].id),
          tankId: current.tankId || (tankData[0] ? String(tankData[0].id) : ''),
        }));
      } else if (!dispenserForm.tankId && tankData.length > 0) {
        setDispenserForm((current) => ({
          ...current,
          tankId: String(tankData[0].id),
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

  function handleDriverFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDriverForm((current) => ({ ...current, [name]: value }));
  }

  function handleTankFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setTankForm((current) => ({ ...current, [name]: value }));
  }

  function handleDispenserFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDispenserForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: VehicleCreatePayload = {
        assignedCompanyId: Number(form.assignedCompanyId),
        assignedDriverId: toOptionalNumber(form.assignedDriverId),
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

  async function handleCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingDriver(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: DriverCreatePayload = {
        assignedCompanyId: Number(driverForm.assignedCompanyId),
        fullName: driverForm.fullName.trim(),
        documentId: driverForm.documentId.trim(),
        licenseNumber: toOptionalString(driverForm.licenseNumber),
        phone: toOptionalString(driverForm.phone),
        status: 'active',
      };

      if (!payload.assignedCompanyId || !payload.fullName || !payload.documentId) {
        throw new Error('Empresa, nombre y documento son obligatorios.');
      }

      await createDriverService(payload);
      setSuccessMessage('Chofer creado correctamente.');
      setDriverForm({
        ...initialDriverFormState,
        assignedCompanyId: companies[0] ? String(companies[0].id) : '',
      });
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el chofer.'));
    } finally {
      setCreatingDriver(false);
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

  async function handleVehicleStatusChange(vehicleId: number, status: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateVehicleService(vehicleId, { status });
      setSuccessMessage('Estado del vehiculo actualizado.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo actualizar el estado del vehiculo.'));
    }
  }

  async function handleVehicleDriverChange(vehicleId: number, assignedDriverId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateVehicleService(vehicleId, { assignedDriverId: toOptionalNumber(assignedDriverId) });
      setSuccessMessage('Chofer asignado al vehiculo.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo asignar el chofer.'));
    }
  }

  async function handleDeleteVehicle(vehicleId: number) {
    if (!window.confirm('Quieres borrar este vehiculo?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteVehicleService(vehicleId);
      setSuccessMessage('Vehiculo borrado correctamente.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo borrar el vehiculo.'));
    }
  }

  async function handleTankStatusChange(tankId: number, status: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateTankService(tankId, { status });
      setSuccessMessage('Estado del tanque actualizado.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo actualizar el estado del tanque.'));
    }
  }

  async function handleDeleteTank(tankId: number) {
    if (!window.confirm('Quieres borrar este tanque?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteTankService(tankId);
      setSuccessMessage('Tanque borrado correctamente.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo borrar el tanque.'));
    }
  }

  async function handleDispenserStatusChange(dispenserId: number, status: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateDispenserService(dispenserId, { status });
      setSuccessMessage('Estado del dispensador actualizado.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo actualizar el estado del dispensador.'));
    }
  }

  async function handleDeleteDispenser(dispenserId: number) {
    if (!window.confirm('Quieres borrar este dispensador?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteDispenserService(dispenserId);
      setSuccessMessage('Dispensador borrado correctamente.');
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo borrar el dispensador.'));
    }
  }

  async function handleCreateTank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingTank(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: TankCreatePayload = {
        assignedCompanyId: Number(tankForm.assignedCompanyId),
        code: tankForm.code.trim(),
        name: tankForm.name.trim(),
        location: tankForm.location.trim(),
        fuelType: tankForm.fuelType.trim() || 'diesel',
        capacity: Number(tankForm.capacity),
        currentVolume: Number(tankForm.currentVolume || 0),
        temperature: toOptionalNumber(tankForm.temperature),
        density: toOptionalNumber(tankForm.density),
        sensorIdentifier: toOptionalString(tankForm.sensorIdentifier),
        status: 'operational',
      };

      if (!payload.assignedCompanyId || !payload.code || !payload.name || !payload.location || !payload.capacity) {
        throw new Error('Empresa, codigo, nombre, ubicacion y capacidad son obligatorios.');
      }

      if (payload.currentVolume > payload.capacity) {
        throw new Error('El volumen actual no puede ser mayor que la capacidad.');
      }

      await createTankService(payload);
      setSuccessMessage('Tanque creado correctamente.');
      setTankForm({
        ...initialTankFormState,
        assignedCompanyId: companies[0] ? String(companies[0].id) : '',
      });
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el tanque.'));
    } finally {
      setCreatingTank(false);
    }
  }

  async function handleCreateDispenser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingDispenser(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: DispenserCreatePayload = {
        assignedCompanyId: Number(dispenserForm.assignedCompanyId),
        tankId: Number(dispenserForm.tankId),
        code: dispenserForm.code.trim(),
        name: dispenserForm.name.trim(),
        location: dispenserForm.location.trim(),
        totalizer: Number(dispenserForm.totalizer || 0),
        deviceIdentifier: toOptionalString(dispenserForm.deviceIdentifier),
        status: 'online',
      };

      if (!payload.assignedCompanyId || !payload.tankId || !payload.code || !payload.name || !payload.location) {
        throw new Error('Empresa, tanque, codigo, nombre y ubicacion son obligatorios.');
      }

      await createDispenserService(payload);
      setSuccessMessage('Dispensador creado correctamente.');
      setDispenserForm({
        ...initialDispenserFormState,
        assignedCompanyId: companies[0] ? String(companies[0].id) : '',
        tankId: tanks[0] ? String(tanks[0].id) : '',
      });
      await loadFleetData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el dispensador.'));
    } finally {
      setCreatingDispenser(false);
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
              Chofer asignado
              <select
                name="assignedDriverId"
                value={form.assignedDriverId}
                onChange={handleFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400"
              >
                <option value="">Sin chofer</option>
                {drivers
                  .filter((driver) => !form.assignedCompanyId || driver.assignedCompanyId === Number(form.assignedCompanyId))
                  .map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.fullName}
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

      <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600">
              Choferes
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Crear chofer y asignarlo a vehiculos
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Los administradores pueden registrar conductores por empresa y enlazarlos a cada unidad.
            </p>
          </div>
          <div className="rounded-3xl bg-indigo-50 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-700">Choferes</p>
            <p className="text-3xl font-semibold text-slate-900">{drivers.length}</p>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateDriver}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Empresa
            <select
              name="assignedCompanyId"
              value={driverForm.assignedCompanyId}
              onChange={handleDriverFormChange}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400"
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
            Nombre
            <input
              name="fullName"
              value={driverForm.fullName}
              onChange={handleDriverFormChange}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400"
              placeholder="Nombre completo"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Documento
            <input
              name="documentId"
              value={driverForm.documentId}
              onChange={handleDriverFormChange}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400"
              placeholder="Cedula o codigo"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Licencia
            <input
              name="licenseNumber"
              value={driverForm.licenseNumber}
              onChange={handleDriverFormChange}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400"
              placeholder="LIC-00001"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Telefono
            <input
              name="phone"
              value={driverForm.phone}
              onChange={handleDriverFormChange}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400"
              placeholder="809-000-0000"
            />
          </label>
          <div className="md:col-span-2 xl:col-span-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={creatingDriver || companies.length === 0}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {creatingDriver ? 'Guardando...' : 'Crear chofer'}
            </button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-600">
                Nuevo tanque
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Registro de almacenamiento
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Crea tanques institucionales y asigna su sensor de nivel, temperatura y densidad.
              </p>
            </div>
            <div className="rounded-3xl bg-teal-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.25em] text-teal-700">Tanques</p>
              <p className="text-3xl font-semibold text-slate-900">{tanks.length}</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateTank}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Empresa
              <select
                name="assignedCompanyId"
                value={tankForm.assignedCompanyId}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
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
              Codigo
              <input
                name="code"
                value={tankForm.code}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="TNK-001"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Nombre
              <input
                name="name"
                value={tankForm.name}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="Tanque principal"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Ubicacion
              <input
                name="location"
                value={tankForm.location}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="Patio operativo"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Tipo de combustible
              <input
                name="fuelType"
                value={tankForm.fuelType}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="diesel"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Capacidad litros
              <input
                name="capacity"
                type="number"
                min="1"
                step="0.01"
                value={tankForm.capacity}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="25000"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Volumen actual
              <input
                name="currentVolume"
                type="number"
                min="0"
                step="0.01"
                value={tankForm.currentVolume}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="12000"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Temperatura
              <input
                name="temperature"
                type="number"
                step="0.01"
                value={tankForm.temperature}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="28"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Densidad
              <input
                name="density"
                type="number"
                step="0.001"
                value={tankForm.density}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="0.83"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Sensor del tanque
              <input
                name="sensorIdentifier"
                value={tankForm.sensorIdentifier}
                onChange={handleTankFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="tank-sensor-001"
              />
            </label>

            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creatingTank || companies.length === 0}
                className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creatingTank ? 'Guardando...' : 'Crear tanque'}
              </button>
            </div>
          </form>
        </Card>

        <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
                Nuevo dispensador
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Registro de surtidor
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enlaza cada dispensador a un tanque y deja listo su identificador de dispositivo.
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Surtidores</p>
              <p className="text-3xl font-semibold text-slate-900">{dispensers.length}</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateDispenser}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Empresa
              <select
                name="assignedCompanyId"
                value={dispenserForm.assignedCompanyId}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
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
              Tanque origen
              <select
                name="tankId"
                value={dispenserForm.tankId}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
              >
                <option value="">Selecciona un tanque</option>
                {tanks.map((tank) => (
                  <option key={tank.id} value={tank.id}>
                    {tank.code} · {tank.location}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Codigo
              <input
                name="code"
                value={dispenserForm.code}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="DSP-001"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Nombre
              <input
                name="name"
                value={dispenserForm.name}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="Surtidor isla 1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Ubicacion
              <input
                name="location"
                value={dispenserForm.location}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="Isla 1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Totalizador inicial
              <input
                name="totalizer"
                type="number"
                min="0"
                step="0.01"
                value={dispenserForm.totalizer}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="0"
              />
            </label>

            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium">
              Identificador del dispositivo
              <input
                name="deviceIdentifier"
                value={dispenserForm.deviceIdentifier}
                onChange={handleDispenserFormChange}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="disp-device-001"
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creatingDispenser || companies.length === 0 || tanks.length === 0}
                className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creatingDispenser ? 'Guardando...' : 'Crear dispensador'}
              </button>
              {tanks.length === 0 && !loading ? (
                <span className="text-sm text-amber-700">Primero crea un tanque.</span>
              ) : null}
            </div>
          </form>
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
                <th className="px-3 py-2 font-medium">Chofer</th>
                <th className="px-3 py-2 font-medium">Motor</th>
                <th className="px-3 py-2 font-medium">Asientos</th>
                <th className="px-3 py-2 font-medium">VIN</th>
                <th className="px-3 py-2 font-medium">Sensor</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
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
                    <select
                      value={vehicle.assignedDriverId ?? ''}
                      onChange={(event) => void handleVehicleDriverChange(vehicle.id, event.target.value)}
                      className="max-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Sin chofer</option>
                      {drivers
                        .filter((driver) => driver.assignedCompanyId === vehicle.assignedCompanyId)
                        .map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.fullName}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-3 py-4">
                    {[vehicle.engineType, vehicle.engineDisplacement, vehicle.maxPower]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos'}
                  </td>
                  <td className="px-3 py-4">{vehicle.seatCount ?? 'N/D'}</td>
                  <td className="px-3 py-4">{vehicle.vin ?? 'N/D'}</td>
                  <td className="px-3 py-4">{vehicle.sensorIdentifier ?? 'Sin asignar'}</td>
                  <td className="px-3 py-4">
                    <select
                      value={vehicle.status ?? 'active'}
                      onChange={(event) => void handleVehicleStatusChange(vehicle.id, event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="active">En ruta</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="offline">Fuera de linea</option>
                      <option value="alert">Alerta</option>
                    </select>
                  </td>
                  <td className="rounded-r-2xl px-3 py-4">
                    <button
                      type="button"
                      onClick={() => void handleDeleteVehicle(vehicle.id)}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-600">
                Tanques registrados
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Inventario de almacenamiento</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-3 py-2 font-medium">Tanque</th>
                  <th className="px-3 py-2 font-medium">Volumen</th>
                  <th className="px-3 py-2 font-medium">Temp.</th>
                  <th className="px-3 py-2 font-medium">Sensor</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tanks.slice(0, 10).map((tank) => (
                  <tr key={tank.id} className="rounded-2xl bg-slate-50 text-slate-700">
                    <td className="rounded-l-2xl px-3 py-4">
                      <p className="font-semibold text-slate-900">{tank.code}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {tank.location} · {tank.fuelType}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {tank.currentVolume.toFixed(1)} / {tank.capacity.toFixed(1)} L
                    </td>
                    <td className="px-3 py-4">{tank.temperature?.toFixed(1) ?? 'N/D'}</td>
                    <td className="px-3 py-4">{tank.sensorIdentifier ?? 'Sin asignar'}</td>
                    <td className="px-3 py-4">
                      <select
                        value={tank.status}
                        onChange={(event) => void handleTankStatusChange(tank.id, event.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="operational">En linea</option>
                        <option value="maintenance">Mantenimiento</option>
                        <option value="offline">Fuera de linea</option>
                        <option value="alarm">Alarma</option>
                      </select>
                    </td>
                    <td className="rounded-r-2xl px-3 py-4">
                      <button
                        type="button"
                        onClick={() => void handleDeleteTank(tank.id)}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-0 bg-white/90 shadow-xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
                Dispensadores registrados
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Inventario de surtidores</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-3 py-2 font-medium">Dispensador</th>
                  <th className="px-3 py-2 font-medium">Tanque</th>
                  <th className="px-3 py-2 font-medium">Totalizador</th>
                  <th className="px-3 py-2 font-medium">Dispositivo</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {dispensers.slice(0, 10).map((dispenser) => (
                  <tr key={dispenser.id} className="rounded-2xl bg-slate-50 text-slate-700">
                    <td className="rounded-l-2xl px-3 py-4">
                      <p className="font-semibold text-slate-900">{dispenser.code}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {dispenser.location} · {dispenser.status}
                      </p>
                    </td>
                    <td className="px-3 py-4">{dispenser.tankCode ?? dispenser.tankId}</td>
                    <td className="px-3 py-4">{dispenser.totalizer.toFixed(1)} L</td>
                    <td className="px-3 py-4">{dispenser.deviceIdentifier ?? 'Sin asignar'}</td>
                    <td className="px-3 py-4">
                      <select
                        value={dispenser.status}
                        onChange={(event) => void handleDispenserStatusChange(dispenser.id, event.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="online">En linea</option>
                        <option value="maintenance">Mantenimiento</option>
                        <option value="offline">Fuera de linea</option>
                        <option value="blocked">Bloqueado</option>
                      </select>
                    </td>
                    <td className="rounded-r-2xl px-3 py-4">
                      <button
                        type="button"
                        onClick={() => void handleDeleteDispenser(dispenser.id)}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

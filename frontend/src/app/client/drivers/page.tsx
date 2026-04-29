'use client';

import { getApiErrorMessage } from '@/services/api/client';
import {
  DriverApi,
  createDriverService,
  deleteDriverService,
  getDriversService,
  updateDriverService,
} from '@/services/fuel/service';
import {
  VehicleApi,
  getVehiclesService,
  updateVehicleService,
} from '@/services/vehicles/service';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type DriverForm = {
  fullName: string;
  documentId: string;
  licenseNumber: string;
  phone: string;
};

const emptyForm: DriverForm = {
  fullName: '',
  documentId: '',
  licenseNumber: '',
  phone: '',
};

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function ClientDriversPage() {
  const [drivers, setDrivers] = useState<DriverApi[]>([]);
  const [vehicles, setVehicles] = useState<VehicleApi[]>([]);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const companyId = useMemo(() => {
    const stored = typeof window !== 'undefined' ? Number(localStorage.getItem('companyId')) : 0;
    return stored || vehicles[0]?.assignedCompanyId || drivers[0]?.assignedCompanyId || 0;
  }, [drivers, vehicles]);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [driverData, vehicleData] = await Promise.all([
        getDriversService(),
        getVehiclesService(),
      ]);
      setDrivers(driverData);
      setVehicles(vehicleData);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar conductores y vehiculos.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCanEdit(localStorage.getItem('rol') === 'admin');
    void loadData();
  }, []);

  function startEdit(driver: DriverApi) {
    setEditingId(driver.id);
    setForm({
      fullName: driver.fullName,
      documentId: driver.documentId,
      licenseNumber: driver.licenseNumber ?? '',
      phone: driver.phone ?? '',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      setErrorMessage('Tu usuario solo tiene permisos de visualización.');
      return;
    }
    if (!companyId) {
      setErrorMessage('No se pudo identificar la empresa del usuario.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        documentId: form.documentId.trim(),
        licenseNumber: optional(form.licenseNumber),
        phone: optional(form.phone),
        status: 'active',
        assignedCompanyId: companyId,
      };
      if (!payload.fullName || !payload.documentId) {
        throw new Error('Nombre y documento son obligatorios.');
      }
      if (editingId) {
        await updateDriverService(editingId, payload);
        setSuccessMessage('Conductor actualizado.');
      } else {
        await createDriverService(payload);
        setSuccessMessage('Conductor creado.');
      }
      resetForm();
      await loadData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo guardar el conductor.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(driverId: number) {
    if (!canEdit) return;
    if (!window.confirm('Quieres borrar este conductor?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteDriverService(driverId);
      setSuccessMessage('Conductor borrado.');
      await loadData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo borrar el conductor.'));
    }
  }

  async function handleAssignVehicle(vehicleId: number, assignedDriverId: string) {
    if (!canEdit) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateVehicleService(vehicleId, {
        assignedDriverId: assignedDriverId ? Number(assignedDriverId) : null,
      });
      setSuccessMessage('Conductor asignado al vehiculo.');
      await loadData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo asignar el conductor.'));
    }
  }

  if (loading) {
    return <div className="rounded-[30px] border border-white/10 bg-white/6 p-6 text-slate-200">Cargando conductores...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] bg-[linear-gradient(135deg,#10243f_0%,#155e75_55%,#312e81_130%)] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/75">Operación</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Conductores</h2>
            <p className="mt-3 max-w-3xl text-sm text-cyan-50/85 md:text-base">
              Administra choferes de la compañía y asígnalos a las unidades. Los usuarios de lectura pueden consultar esta misma información sin editarla.
            </p>
          </div>
          <span className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">
            {canEdit ? 'Modo administrador' : 'Solo lectura'}
          </span>
        </div>
      </section>

      {errorMessage ? <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form className="rounded-[30px] border border-white/10 bg-white/6 p-5 text-white backdrop-blur-sm" onSubmit={handleSubmit}>
          <h3 className="text-2xl font-semibold">{editingId ? 'Editar conductor' : 'Nuevo conductor'}</h3>
          <div className="mt-5 grid gap-3">
            {[
              ['fullName', 'Nombre completo'],
              ['documentId', 'Documento'],
              ['licenseNumber', 'Licencia'],
              ['phone', 'Teléfono'],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-2 text-sm">
                {label}
                <input
                  value={form[key as keyof DriverForm]}
                  disabled={!canEdit}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear conductor'}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-[30px] border border-white/10 bg-white/6 p-5 text-white backdrop-blur-sm">
          <h3 className="text-2xl font-semibold">Asignación por vehículo</h3>
          <div className="mt-5 overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Vehículo</th>
                  <th className="px-3 py-2 font-medium">Conductor</th>
                  <th className="px-3 py-2 font-medium">Sensor</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="bg-slate-950/35">
                    <td className="rounded-l-2xl px-3 py-3">
                      <p className="font-semibold">{vehicle.plate}</p>
                      <p className="text-xs text-slate-400">{vehicle.brand} {vehicle.model}</p>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={vehicle.assignedDriverId ?? ''}
                        disabled={!canEdit}
                        onChange={(event) => void handleAssignVehicle(vehicle.id, event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none disabled:opacity-60"
                      >
                        <option value="">Sin conductor</option>
                        {drivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>{driver.fullName}</option>
                        ))}
                      </select>
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 text-slate-300">{vehicle.sensorIdentifier ?? 'Sin sensor'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/6 p-5 text-white backdrop-blur-sm">
        <h3 className="text-2xl font-semibold">Conductores registrados</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drivers.map((driver) => (
            <article key={driver.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-lg font-semibold">{driver.fullName}</p>
              <p className="mt-1 text-sm text-slate-300">{driver.documentId}</p>
              <p className="mt-2 text-xs text-slate-400">{driver.licenseNumber ?? 'Sin licencia'} · {driver.phone ?? 'Sin teléfono'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => startEdit(driver)}
                  className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void handleDelete(driver.id)}
                  className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  Borrar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

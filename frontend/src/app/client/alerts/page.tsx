'use client';

import { getApiErrorMessage } from '@/services/api/client';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  AlertEventApi,
  AlertThresholdApi,
  closeAlertEventService,
  createAlertThresholdService,
  getAlertEventsService,
  getAlertThresholdsService,
  updateAlertThresholdService,
} from '@/services/fuel/service';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const ALERT_CONFIGS = [
  {
    metric: 'vehicle_fuel_drop_percent',
    title: 'Posible robo de combustible',
    description: 'Diferencia máxima permitida entre la medición anterior y la actual.',
    unit: '%',
    field: 'variationLimit',
    defaultValue: 12,
    icon: 'bx-shield-quarter',
  },
  {
    metric: 'vehicle_fuel_level',
    title: 'Nivel bajo en vehículo',
    description: 'Nivel mínimo permitido antes de generar alerta.',
    unit: '%',
    field: 'minValue',
    defaultValue: 15,
    icon: 'bx-car',
  },
  {
    metric: 'tank_level_percent',
    title: 'Nivel de tanque',
    description: 'Rango operativo esperado del tanque institucional.',
    unit: '%',
    field: 'range',
    defaultValue: 18,
    defaultMax: 92,
    icon: 'bx-cylinder',
  },
  {
    metric: 'tank_temperature',
    title: 'Temperatura de tanque',
    description: 'Temperatura máxima antes de generar alerta.',
    unit: 'C',
    field: 'maxValue',
    defaultValue: 38,
    icon: 'bx-temperature',
  },
] as const;

type AlertFormState = Record<string, {
  enabled: boolean;
  minValue: string;
  maxValue: string;
  variationLimit: string;
  notificationEmail: string;
}>;

function emptyState(): AlertFormState {
  return Object.fromEntries(
    ALERT_CONFIGS.map((config) => [
      config.metric,
      {
        enabled: true,
        minValue: config.field === 'minValue' || config.field === 'range' ? String(config.defaultValue) : '',
        maxValue: config.field === 'maxValue' || config.field === 'range'
          ? String('defaultMax' in config ? config.defaultMax : config.defaultValue)
          : '',
        variationLimit: config.field === 'variationLimit' ? String(config.defaultValue) : '',
        notificationEmail: '',
      },
    ]),
  );
}

function toNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ClientAlertsPage() {
  const [events, setEvents] = useState<AlertEventApi[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholdApi[]>([]);
  const [form, setForm] = useState<AlertFormState>(() => emptyState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingAlertId, setClosingAlertId] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadThresholds() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getAlertThresholdsService();
      setThresholds(data);
      setForm((current) => {
        const next = { ...current };
        for (const threshold of data) {
          if (!next[threshold.metric]) continue;
          next[threshold.metric] = {
            enabled: threshold.enabled,
            minValue: threshold.minValue?.toString() ?? '',
            maxValue: threshold.maxValue?.toString() ?? '',
            variationLimit: threshold.variationLimit?.toString() ?? '',
            notificationEmail: threshold.notificationEmail ?? '',
          };
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar las alertas configurables.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadAlertEvents() {
    try {
      setEvents(await getAlertEventsService(100));
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    setCanEdit(localStorage.getItem('rol') === 'admin');
    void loadThresholds();
    void loadAlertEvents();
  }, []);

  useRealtimeRefresh(['alert.created', 'alert.resolved', 'fuel.simulation.updated', 'vehicle.telemetry.updated'], () => {
    void loadAlertEvents();
  });

  const thresholdByMetric = useMemo(() => {
    return new Map(thresholds.map((threshold) => [threshold.metric, threshold]));
  }, [thresholds]);

  function updateField(metric: string, key: keyof AlertFormState[string], value: string | boolean) {
    setForm((current) => ({
      ...current,
      [metric]: {
        ...current[metric],
        [key]: value,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      setErrorMessage('Tu usuario solo tiene permisos de visualización.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      for (const config of ALERT_CONFIGS) {
        const state = form[config.metric];
        const payload = {
          scope: 'company',
          metric: config.metric,
          minValue: toNumber(state.minValue),
          maxValue: toNumber(state.maxValue),
          variationLimit: toNumber(state.variationLimit),
          notificationEmail: state.notificationEmail.trim() || null,
          enabled: state.enabled,
        };
        const existing = thresholdByMetric.get(config.metric);
        if (existing) {
          await updateAlertThresholdService(existing.id, payload);
        } else {
          await createAlertThresholdService(payload);
        }
      }
      setSuccessMessage('Configuración de alertas guardada.');
      await loadThresholds();
      await loadAlertEvents();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo guardar la configuración de alertas.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseAlert(alertId: number) {
    setClosingAlertId(alertId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await closeAlertEventService(alertId);
      setSuccessMessage('Alerta cerrada correctamente.');
      await loadAlertEvents();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cerrar la alerta.'));
    } finally {
      setClosingAlertId(null);
    }
  }

  if (loading) {
    return <div className="rounded-[30px] border border-white/10 bg-white/6 p-6 text-slate-200">Cargando alertas...</div>;
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f2942_0%,#155e75_48%,#7f1d1d_130%)] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/75">Configuración</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Alertas personalizadas</h2>
            <p className="mt-3 max-w-3xl text-sm text-cyan-50/85 md:text-base">
              Ajusta umbrales por empresa, incluyendo el margen de diferencia entre lecturas para detectar posible robo de combustible.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:opacity-60"
          >
            <i className="bx bx-save" />
            {saving ? 'Guardando...' : canEdit ? 'Guardar alertas' : 'Solo lectura'}
          </button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/6 p-5 text-white backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Eventos</p>
            <h3 className="mt-2 text-2xl font-semibold">Alertas recientes</h3>
          </div>
          <button
            type="button"
            onClick={() => void loadAlertEvents()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
          >
            <i className="bx bx-refresh" />
            Actualizar
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
              No hay alertas registradas para esta vista.
            </div>
          ) : (
            events.map((event) => {
              const isOpen = event.status.toLowerCase() === 'open';
              const isClosing = closingAlertId === event.id;

              return (
              <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                        {event.entityType} #{event.entityId ?? event.vehicleId ?? '-'}
                      </span>
                      <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-100">
                        {event.severity}
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                        {event.status}
                      </span>
                    </div>
                    <h4 className="mt-2 text-base font-semibold">{event.title}</h4>
                    <p className="mt-1 text-sm text-slate-300">{event.message}</p>
                  </div>
                  <div className="text-left text-xs text-slate-400 md:text-right">
                    <p>{event.alertType}</p>
                    <p className="mt-1">{new Date(event.recordedAt).toLocaleString('es-DO')}</p>
                    {isOpen ? (
                      <button
                        type="button"
                        onClick={() => void handleCloseAlert(event.id)}
                        disabled={isClosing}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className="bx bx-check-circle" />
                        {isClosing ? 'Cerrando...' : 'Cerrar alerta'}
                      </button>
                    ) : event.resolvedAt ? (
                      <p className="mt-2 text-emerald-200">Cerrada {new Date(event.resolvedAt).toLocaleString('es-DO')}</p>
                    ) : null}
                  </div>
                </div>
              </article>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {ALERT_CONFIGS.map((config) => {
          const state = form[config.metric];
          return (
            <article key={config.metric} className="rounded-[30px] border border-white/10 bg-white/6 p-5 text-white backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{config.metric}</p>
                  <h3 className="mt-2 text-2xl font-semibold">{config.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{config.description}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl text-cyan-200">
                  <i className={`bx ${config.icon}`} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Mínimo {config.unit}
                  <input
                    type="number"
                    step="0.01"
                    value={state.minValue}
                    disabled={!canEdit}
                    onChange={(event) => updateField(config.metric, 'minValue', event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none"
                    placeholder="Sin mínimo"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Máximo {config.unit}
                  <input
                    type="number"
                    step="0.01"
                    value={state.maxValue}
                    disabled={!canEdit}
                    onChange={(event) => updateField(config.metric, 'maxValue', event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none"
                    placeholder="Sin máximo"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Variación brusca {config.unit}
                  <input
                    type="number"
                    step="0.01"
                    value={state.variationLimit}
                    disabled={!canEdit}
                    onChange={(event) => updateField(config.metric, 'variationLimit', event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none"
                    placeholder="Ej. 12"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Correo de notificación
                  <input
                    type="email"
                    value={state.notificationEmail}
                    disabled={!canEdit}
                    onChange={(event) => updateField(config.metric, 'notificationEmail', event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none"
                    placeholder="operaciones@empresa.com"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-950/35 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                    checked={state.enabled}
                    disabled={!canEdit}
                  onChange={(event) => updateField(config.metric, 'enabled', event.target.checked)}
                  className="h-4 w-4"
                />
                Alerta habilitada
              </label>
            </article>
          );
        })}
      </section>
    </form>
  );
}

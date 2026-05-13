'use client';

import { getApiErrorMessage } from '@/services/api/client';
import {
  createCustomRoleService,
  getAuditExportService,
  getConsumptionForecastService,
  getCustomRolesService,
  getNotificationLogsService,
  getSecurityEvidenceService,
  CustomRoleApi,
  NotificationLogApi,
  SecurityEvidenceApi,
  ConsumptionForecastApi,
} from '@/services/fuel/service';
import { FormEvent, useEffect, useState } from 'react';

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function CompliancePage() {
  const [notifications, setNotifications] = useState<NotificationLogApi[]>([]);
  const [auditExport, setAuditExport] = useState<{ retentionPolicy: string; records: Array<Record<string, unknown>> } | null>(null);
  const [roles, setRoles] = useState<CustomRoleApi[]>([]);
  const [security, setSecurity] = useState<SecurityEvidenceApi | null>(null);
  const [forecast, setForecast] = useState<ConsumptionForecastApi | null>(null);
  const [roleName, setRoleName] = useState('Solo informes');
  const [permissions, setPermissions] = useState('reports:view, exports:csv, dashboard:view');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [notificationData, auditData, roleData, securityData, forecastData] = await Promise.all([
        getNotificationLogsService(50),
        getAuditExportService(200),
        getCustomRolesService(),
        getSecurityEvidenceService(),
        getConsumptionForecastService(1, 80),
      ]);
      setNotifications(notificationData);
      setAuditExport(auditData);
      setRoles(roleData);
      setSecurity(securityData);
      setForecast(forecastData);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar cumplimiento operacional.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createCustomRoleService({
        name: roleName,
        description: 'Rol custom para restricción por módulo.',
        assignedCompanyId: null,
        permissions: permissions.split(',').map((item) => item.trim()).filter(Boolean),
        status: 'active',
      });
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el rol custom.'));
    }
  }

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">D/E</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Alarmas, seguridad, reportes y KPIs</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Evidencia operativa para alarmas configurables, notificaciones, auditoría, RBAC, seguridad, forecasting y exportación.
        </p>
      </section>

      {errorMessage ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
      {loading ? <div className="rounded-lg bg-white p-5 text-sm text-slate-500 shadow-sm">Cargando evidencia...</div> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Alarmas y notificaciones</h2>
          <p className="mt-1 text-sm text-slate-600">Canales soportados: interna, email, SMS y webhook. Se registra envío y recepción.</p>
          <div className="mt-4 max-h-72 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Enviado</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold">{item.channel}</td>
                    <td className="px-3 py-2">{item.recipient ?? '-'}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">{item.provider}</td>
                    <td className="px-3 py-2">{new Date(item.sentAt).toLocaleString('es-DO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Auditoría inmutable</h2>
          <p className="mt-1 text-sm text-slate-600">Retención mínima: {auditExport?.retentionPolicy ?? '5 years minimum'}. Cada registro exportado incluye SHA-256.</p>
          <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {json((auditExport?.records ?? []).slice(0, 5))}
          </pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">RBAC custom</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleCreateRole}>
            <input className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
            <input className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" value={permissions} onChange={(event) => setPermissions(event.target.value)} />
            <button className="rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white">Crear rol</button>
          </form>
          <div className="mt-4 space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{role.name}</p>
                <p className="text-slate-600">{role.permissions.join(', ')}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Seguridad de datos</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {json(security)}
          </pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-semibold">Forecast y KPIs gerenciales</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Método</p>
              <p className="mt-2 font-semibold">{forecast?.method ?? '-'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Promedio diario</p>
              <p className="mt-2 font-semibold">{forecast?.dailyAverage ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Pronóstico mensual</p>
              <p className="mt-2 font-semibold">{forecast?.monthlyForecast ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Intervalo</p>
              <p className="mt-2 font-semibold">{forecast ? `${forecast.confidenceInterval.low} - ${forecast.confidenceInterval.high}` : '-'}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Export terceros disponible por API: `/reports/exports/tanks.csv`, `/reports/exports/transactions.csv`, `/reports/exports/alerts.json`.
          </p>
        </article>
      </section>
    </div>
  );
}

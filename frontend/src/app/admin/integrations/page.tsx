'use client';

import { getApiErrorMessage } from '@/services/api/client';
import {
  createWebhookService,
  getIntegrationEvidenceService,
  getIntegrationOpenApiEvidenceService,
  getOperationsEvidenceService,
  getOperationsHealthService,
  getWebhooksService,
  testWebhookService,
  WebhookEndpointApi,
} from '@/services/fuel/service';
import { FormEvent, useEffect, useState } from 'react';

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function IntegrationsPage() {
  const [openapi, setOpenapi] = useState<Record<string, unknown> | null>(null);
  const [integration, setIntegration] = useState<Record<string, unknown> | null>(null);
  const [operations, setOperations] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookEndpointApi[]>([]);
  const [name, setName] = useState('ERP NetoFuel');
  const [url, setUrl] = useState('https://example.local/webhooks/netofuel');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [openapiData, integrationData, operationData, healthData, webhookData] = await Promise.all([
        getIntegrationOpenApiEvidenceService(),
        getIntegrationEvidenceService(),
        getOperationsEvidenceService(),
        getOperationsHealthService(),
        getWebhooksService(),
      ]);
      setOpenapi(openapiData);
      setIntegration(integrationData);
      setOperations(operationData);
      setHealth(healthData);
      setWebhooks(webhookData);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar integraciones y operaciones.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreateWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    try {
      const created = await createWebhookService({
        name,
        url,
        eventTypes: 'alert.created,transaction.created',
        retryCount: 3,
        secret: null,
        status: 'active',
      });
      const result = await testWebhookService({
        webhookId: created.id,
        eventType: 'alert.created',
        payload: { severity: 'high', message: 'Evento crítico simulado' },
      });
      setTestResult(result);
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo probar el webhook.'));
    }
  }

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">F/G</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Integraciones, APIs y operaciones</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Evidencia operativa para OpenAPI, webhooks, AD/LDAP, ERP, arquitectura, backup, HA y health checks.
        </p>
      </section>

      {errorMessage ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
      {loading ? <div className="rounded-lg bg-white p-5 text-sm text-slate-500 shadow-sm">Cargando evidencia...</div> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">OpenAPI / Swagger</h2>
          <p className="mt-2 text-sm text-slate-600">Swagger UI: <span className="font-semibold">/docs</span>. OpenAPI JSON: <span className="font-semibold">/openapi.json</span>.</p>
          <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{pretty(openapi)}</pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Webhooks críticos</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleCreateWebhook}>
            <input className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" value={url} onChange={(event) => setUrl(event.target.value)} />
            <button className="rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white">Crear y simular recepción</button>
          </form>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{pretty(testResult ?? webhooks)}</pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">AD/LDAP y ERP</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{pretty(integration)}</pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Health checks</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{pretty(health)}</pre>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-semibold">Arquitectura, backup y HA</h2>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{pretty(operations)}</pre>
        </article>
      </section>
    </div>
  );
}

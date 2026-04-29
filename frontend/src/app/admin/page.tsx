'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const monthlyData = [
  { name: 'Ene', clientes: 30, despachos: 72 },
  { name: 'Feb', clientes: 45, despachos: 96 },
  { name: 'Mar', clientes: 60, despachos: 128 },
  { name: 'Abr', clientes: 80, despachos: 154 },
  { name: 'May', clientes: 100, despachos: 171 },
  { name: 'Jun', clientes: 120, despachos: 205 },
  { name: 'Jul', clientes: 150, despachos: 228 },
  { name: 'Ago', clientes: 170, despachos: 241 },
  { name: 'Sep', clientes: 200, despachos: 266 },
  { name: 'Oct', clientes: 220, despachos: 291 },
  { name: 'Nov', clientes: 238, despachos: 315 },
  { name: 'Dic', clientes: 248, despachos: 338 },
];

const clientStatus = [
  { name: 'Activos', value: 248, fill: '#0891b2' },
  { name: 'En revisión', value: 36, fill: '#f59e0b' },
  { name: 'Inactivos', value: 16, fill: '#64748b' },
];

const operationalCards = [
  {
    title: 'Vehículos monitoreados',
    value: '50+',
    detail: 'Telemetría, combustible y ubicación',
    icon: 'bx-car',
    tone: 'bg-cyan-50 text-cyan-700',
  },
  {
    title: 'Tanques institucionales',
    value: '10',
    detail: 'Nivel, temperatura, densidad y volumen',
    icon: 'bx-cylinder',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Dispensadores',
    value: '10',
    detail: 'Totalizadores y transacciones',
    icon: 'bx-gas-pump',
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Auditoría',
    value: 'Activa',
    detail: 'Usuarios, dispositivos y suministro',
    icon: 'bx-shield-quarter',
    tone: 'bg-violet-50 text-violet-700',
  },
];

const quickActions = [
  { label: 'Crear vehículos', href: '/admin/fleet', icon: 'bx-car' },
  { label: 'Crear tanques', href: '/admin/fleet', icon: 'bx-cylinder' },
  { label: 'Ver combustible', href: '/admin/fuel', icon: 'bx-gas-pump' },
  { label: 'Gestionar usuarios', href: '/admin/users', icon: 'bx-user' },
];

const totalClients = clientStatus.reduce((acc, curr) => acc + curr.value, 0);

function KpiPanel({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-2xl ${tone}`}>
          <i className={`bx ${icon}`} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{detail}</p>
    </article>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg bg-slate-950 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/75">Resumen ejecutivo</p>
            <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Operación NetoFuel</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Control centralizado de flota, almacenamiento, despacho, políticas de suministro,
              alertas y conciliación operativa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:w-[520px]">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-lg border border-white/10 bg-white/8 px-3 py-3 text-center font-semibold text-slate-100 transition hover:bg-white hover:text-slate-950"
              >
                <i className={`bx ${action.icon} mb-1 block text-2xl`} />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {operationalCards.map((card) => (
          <KpiPanel key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Crecimiento</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Clientes y despachos</h2>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Últimos 12 meses
            </span>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(value: number, name: string) => [
                    new Intl.NumberFormat('es-DO').format(value),
                    name === 'clientes' ? 'Clientes' : 'Despachos',
                  ]}
                />
                <Bar dataKey="clientes" fill="#0891b2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despachos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Cartera</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Estado de clientes</h2>
          </div>
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={clientStatus}
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={4}
                  cornerRadius={8}
                >
                  {clientStatus.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(value: number, name: string) => [
                    new Intl.NumberFormat('es-DO').format(value),
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {clientStatus.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-950">{item.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-3 text-white">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-semibold">{totalClients}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

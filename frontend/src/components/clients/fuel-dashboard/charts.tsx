import { DispenserApi, TankApi } from '@/services/fuel/service';
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
import { downloadExcelFile } from './export';
import { volume } from './format';

export function TankCapacityChart({ data, tanks }: { data: Array<{ name: string; volumen: number; capacidad: number }>; tanks: TankApi[] }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tanques</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Capacidad vs volumen</h3>
        </div>
        <button
          type="button"
          onClick={() => downloadExcelFile('netofuel_tanques.xls', [{ title: 'Tanques', rows: tanks }])}
          className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-200"
        >
          Excel
        </button>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
            <Bar dataKey="capacidad" fill="#334155" radius={[4, 4, 0, 0]} name="Capacidad" />
            <Bar dataKey="volumen" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Volumen" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function DispenserTotalizerChart({ data, dispensers }: { data: Array<{ name: string; totalizador: number }>; dispensers: DispenserApi[] }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispensadores</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Totalizadores</h3>
        </div>
        <button
          type="button"
          onClick={() => downloadExcelFile('netofuel_dispensadores.xls', [{ title: 'Dispensadores', rows: dispensers }])}
          className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-200"
        >
          Excel
        </button>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
            <Bar dataKey="totalizador" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Totalizador" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function FuelDistributionChart({ data }: { data: Array<{ name: string; value: number; fill: string }> }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Distribución</p>
        <h3 className="mt-1 text-xl font-semibold text-white">Almacenado, disponible y no conciliado</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius="58%" outerRadius="84%" paddingAngle={4} cornerRadius={8}>
                {data.map((item) => <Cell key={item.name} fill={item.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 18 }} formatter={(value) => volume(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 self-center">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span>
              <span className="font-semibold text-white">{volume(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

import { TankApi } from '@/services/fuel/service';
import { volume } from './format';

export function TankDetail({ tank }: { tank: TankApi }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tanque seleccionado</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">{tank.code}</h3>
          <p className="mt-2 text-sm text-slate-300">{tank.name} · {tank.location}</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-100">
          {tank.status}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Volumen</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(tank.currentVolume)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Capacidad</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(tank.capacity)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Temperatura</p>
          <p className="mt-2 text-xl font-semibold text-white">{tank.temperature?.toFixed(1) ?? 'N/D'} C</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Densidad</p>
          <p className="mt-2 text-xl font-semibold text-white">{tank.density?.toFixed(3) ?? 'N/D'}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
          <span>Nivel de llenado</span>
          <span>{tank.fillPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.min(100, Math.max(0, tank.fillPercent))}%` }} />
        </div>
      </div>
    </article>
  );
}

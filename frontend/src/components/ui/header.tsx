'use client';

import { useBusContext } from '@/hooks/client/provider';
import { getBusTone, getLatestDiesel } from '@/hooks/client/vehicleUi';
import { logoutService } from '@/services/auth/logout';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

type HeaderProps = {
  onMenuClick?: () => void;
};

const navItems = [
  { label: 'Dashboard', path: '/client' },
  { label: 'Mapa', path: '/client/map' },
];

const emptyBusTone = {
  badge: 'bg-slate-500/15 text-slate-100 ring-1 ring-slate-300/20',
  accent: 'from-cyan-400 to-emerald-300',
};

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { busSelected, loading } = useBusContext();

  const bus = busSelected;
  const tone = bus ? getBusTone(bus) : emptyBusTone;

  const handleLogout = async () => {
    try {
      await logoutService();
    } catch {
      // keep local logout even if backend is offline
    } finally {
      localStorage.removeItem('username');
      localStorage.removeItem('rol');
      localStorage.removeItem('token');
      startTransition(() => router.push('/'));
    }
  };

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-slate-100 transition hover:bg-white/10 lg:hidden"
          >
            <i className='bx bx-menu'></i>
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">Centro de monitoreo</p>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Operaciones del cliente</h1>
            <p className="mt-1 text-sm text-slate-300">
              {bus ? `${bus.name} · ${bus.route}` : 'Selecciona una unidad para ver sus métricas.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold transition ${tone.badge}`}>
            {loading ? 'Cargando...' : 'Base de datos'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            Solo datos reales
          </span>
          {bus && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
              {bus.plate} · {getLatestDiesel(bus).toFixed(1)}%
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-950/30 transition hover:scale-[1.02] disabled:opacity-70"
          >
            <i className='bx bx-log-out'></i>
            {isPending ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2 rounded-[24px] border border-white/10 bg-white/5 p-2 backdrop-blur-md">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-medium transition',
                active
                  ? 'bg-white text-slate-950 shadow-lg shadow-cyan-950/20'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

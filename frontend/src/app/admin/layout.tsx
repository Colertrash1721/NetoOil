'use client';
import { logoutService } from '@/services/auth/logout';
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
    const [navOpen, setNavOpen] = useState<boolean>(false);
    const [isPending, startTransition] = useTransition();
    const [currentRole, setCurrentRole] = useState<string | null>(null);

    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        setCurrentRole(localStorage.getItem('rol'));
    }, []);

    const routes = [
        { name: 'Dashboard', path: '/admin', icon: 'bx-home-alt-2' },
        { name: 'Vehiculos', path: '/admin/fleet', icon: 'bx-car' },
        { name: 'Combustible', path: '/admin/fuel', icon: 'bx-gas-pump' },
        { name: 'Analytics', path: '/admin/analytics', icon: 'bx-bar-chart-alt-2' },
        { name: 'Trazabilidad', path: '/admin/traceability', icon: 'bx-git-branch' },
        { name: 'Cumplimiento', path: '/admin/compliance', icon: 'bx-shield-quarter' },
        { name: 'Integraciones', path: '/admin/integrations', icon: 'bx-plug' },
        ...(currentRole === 'superadmin'
            ? [
                { name: 'Users', path: '/admin/users', icon: 'bx-user' },
                { name: 'Admins', path: '/admin/profile', icon: 'bx-key' },
                { name: 'Simulación', path: '/admin/simulation', icon: 'bx-test-tube' },
            ]
            : []),
        { name: 'Logout', path: '/logout', icon: 'bx-log-out' },
    ];

    const activeRoute = routes
        .filter((route) => route.name !== 'Logout')
        .find((route) => pathname === route.path || (route.path !== '/admin' && pathname.startsWith(route.path)));

    const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        void (async () => {
            try {
                await logoutService();
            } catch {
                // keep local logout even if backend is offline
            } finally {
                localStorage.removeItem('username');
                localStorage.removeItem('rol');
                localStorage.removeItem('token');
                localStorage.removeItem('companyId');
                startTransition(() => router.push('/'));
            }
        })();
    };

    return (
        <section className="min-h-screen bg-slate-950 bg-[url(/assets/richard-horvath-cPccYbPrF-A-unsplash.jpg)] bg-cover bg-center font-quicksand text-slate-900">
            <div className="min-h-screen bg-slate-950/78 p-3 backdrop-blur-[2px] md:p-5">
                <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1800px] gap-4 md:min-h-[calc(100vh-40px)]">
                    <button
                        type="button"
                        onClick={() => setNavOpen(true)}
                        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-slate-950/80 text-2xl text-white shadow-lg backdrop-blur lg:hidden"
                    >
                        <i className='bx bx-menu'></i>
                    </button>

                    <div
                        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition lg:hidden ${navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                        onClick={() => setNavOpen(false)}
                    />

                    <aside
                        className={[
                            'fixed inset-y-3 left-3 z-50 w-[86vw] max-w-[320px] rounded-lg border border-white/12 bg-slate-950/88 p-4 text-white shadow-2xl backdrop-blur-xl transition duration-300 lg:sticky lg:top-5 lg:h-[calc(100vh-40px)] lg:w-[290px] lg:max-w-none lg:translate-x-0',
                            navOpen ? 'translate-x-0' : '-translate-x-[110%]',
                        ].join(' ')}
                    >
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">Admin</p>
                                    <h1 className="mt-1 text-3xl font-semibold tracking-wide text-white">NetoFuel</h1>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNavOpen(false)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xl lg:hidden"
                                >
                                    <i className='bx bx-x'></i>
                                </button>
                            </div>

                            <div className="my-4 rounded-lg border border-cyan-300/15 bg-cyan-300/8 p-3">
                                <p className="text-xs text-cyan-100/70">Panel activo</p>
                                <p className="mt-1 text-sm font-semibold text-white">{activeRoute?.name ?? 'Dashboard'}</p>
                            </div>

                            <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                                {routes.map((route) => {
                                    const isLogout = route.name === 'Logout';
                                    const isActive = !isLogout && (pathname === route.path || (route.path !== '/admin' && pathname.startsWith(route.path)));
                                    return (
                                        <Link
                                            href={route.path}
                                            key={route.name}
                                            onClick={isLogout ? handleLogout : () => setNavOpen(false)}
                                            aria-disabled={isLogout && isPending}
                                            className={[
                                                'group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition',
                                                isLogout
                                                    ? 'mt-auto border border-rose-300/20 bg-rose-500/12 text-rose-100 hover:bg-rose-500/20'
                                                    : isActive
                                                      ? 'bg-white text-slate-950 shadow-lg shadow-black/20'
                                                      : 'text-slate-300 hover:bg-white/8 hover:text-white',
                                            ].join(' ')}
                                        >
                                            <span className={[
                                                'inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl transition',
                                                isActive ? 'bg-slate-950 text-cyan-200' : 'bg-white/8 text-slate-200 group-hover:bg-white/12',
                                            ].join(' ')}>
                                                <i className={`bx ${route.icon}`}></i>
                                            </span>
                                            <span>{isLogout && isPending ? 'Saliendo...' : route.name}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    <div className="flex min-w-0 flex-1 flex-col gap-4 pt-14 lg:pt-0">
                        <header className="rounded-lg border border-white/12 bg-white/92 px-4 py-4 shadow-2xl shadow-black/20 backdrop-blur-xl md:px-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Consola administrativa</p>
                                    <h2 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">
                                        {activeRoute?.name ?? 'Dashboard'}
                                    </h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                        API REST
                                    </span>
                                    <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                        Datos reales
                                    </span>
                                </div>
                            </div>
                        </header>

                        <main className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/12 bg-slate-100/94 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-6">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </section>
    );
}

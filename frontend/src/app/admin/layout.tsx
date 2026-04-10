'use client';
import { logoutService } from '@/services/auth/logout';
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
    const [navOpen, setNavOpen] = useState<boolean>(false);
    const [isPending, startTransition] = useTransition();
    const active = "bg-blue-500 text-white hover:bg-blue-600";
    const inactive = "bg-gray-100 hover:bg-gray-200 text-gray-700";
    const logout = "bg-red-500 text-white hover:bg-red-600";
    
    const pathname = usePathname();
    const router = useRouter();
    
    const routes = [
        { name: 'Dashboard', path: '/admin', icon: 'bx-home-alt-2' },
        { name: 'Vehiculos', path: '/admin/fleet', icon: 'bx-car' },
        { name: 'Analytics', path: '/admin/analytics', icon: 'bx-bar-chart-alt-2' },
        { name: 'Users', path: '/admin/users', icon: 'bx-user' },
        { name: 'Admins', path: '/admin/profile', icon: 'bx-key' },
        { name: 'Logout', path: '/logout', icon: 'bx-log-out' },
    ];

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
                startTransition(() => router.push('/'));
            }
        })();
    };

    const handleButton = () => {
        setNavOpen(!navOpen)
    }

    return (
        <section className="w-full h-full bg-[url(/assets/richard-horvath-cPccYbPrF-A-unsplash.jpg)] bg-cover bg-center flex items-center justify-center font-quicksand">
            <div className="h-full w-full flex flex-col md:flex-row items-center justify-center gap-10 p-5 md:p-20">
            <div className={`text-3xl ${navOpen ? 'text-red-500' : 'text-black'} lg:hidden md: hidden absolute top-10 left-4 cursor-pointer z-100`} onClick={handleButton}><i className='bx bx-menu'></i></div>
                <aside className={`${navOpen ? '-translate-x-full' : 'translate-0'} absolute lg:relative md:relative w-full h-full lg:w-[20%] md:w-[30%] bg-white text-black rounded-2xl shadow-lg flex items-center justify-center p-5 z-20 transition-all`}>
                    <div className="flex flex-col items-center justify-center h-full gap-6 w-full">
                        <nav className="flex flex-col h-full justify-center gap-6 w-full">
                            <h1 className="font-light tracking-[2px] text-3xl md:text-4xl lg:text-5xl text-center">NetoFuel</h1>
                            {routes.map((route) => (
                                <Link 
                                    href={route.path} 
                                    key={route.name} 
                                    onClick={route.name === "Logout" ? handleLogout : undefined}
                                    aria-disabled={route.name === "Logout" && isPending}
                                    className={`w-full py-3 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium ${route.name === "Logout" ? logout : pathname === route.path ? active : inactive}`}
                                >
                                    <i className={`bx ${route.icon}`}></i>
                                    {route.name === "Logout" && isPending ? 'Saliendo...' : route.name}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </aside>
                <div className="w-full h-full p-4 backdrop-blur-md border border-white/40 rounded-lg shadow-lg overflow-y-auto flex flex-col gap-6">
                {children}
                </div>
            </div>
        </section>
    );
}

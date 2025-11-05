'use client';
import { usePathname } from 'next/navigation';
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
    const active = "bg-blue-500 text-white hover:bg-blue-600";
    const inactive = "bg-gray-100 hover:bg-gray-200 text-gray-700";
    const logout = "bg-red-500 text-white hover:bg-red-600";
    
    const pathname = usePathname();
    
    const routes = [
        { name: 'Dashboard', path: '/admin', icon: 'bx-home-alt-2' },
        { name: 'Analytics', path: '/admin/analytics', icon: 'bx-bar-chart-alt-2' },
        { name: 'Settings', path: '/admin/settings', icon: 'bx-cog' },
        { name: 'Profile', path: '/admin/profile', icon: 'bx-user' },
        { name: 'Help', path: '/admin/help', icon: 'bx-help-circle' },
        { name: 'Logout', path: '/logout', icon: 'bx-log-out' },
    ];

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        console.log('Logging out...');
    };

    return (
        <section className="w-full h-full bg-[url(/assets/richard-horvath-cPccYbPrF-A-unsplash.jpg)] bg-cover bg-center flex items-center justify-center font-quicksand">
            <div className="h-full w-full flex flex-col md:flex-row items-center justify-center gap-10 p-5 md:p-20">
                <aside className="lg:w-[20%] lg:h-full md:w-[30%] bg-white text-black rounded-2xl shadow-lg flex items-center justify-center p-5">
                    <div className="flex flex-col items-center justify-center h-full gap-6 w-full">
                        <nav className="flex flex-col h-full justify-center gap-6 w-full">
                            <h1 className="font-light tracking-[2px] text-3xl md:text-4xl lg:text-5xl text-center">NetoOil</h1>
                            {routes.map((route) => (
                                <Link 
                                    href={route.path} 
                                    key={route.name} 
                                    onClick={route.name === "Logout" ? handleLogout : undefined}
                                    className={`w-full py-3 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium ${route.name === "Logout" ? logout : pathname === route.path ? active : inactive}`}
                                >
                                    <i className={`bx ${route.icon}`}></i>
                                    {route.name}
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
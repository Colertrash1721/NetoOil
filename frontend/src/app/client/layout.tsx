'use client';

import Header from '@/components/ui/header';
import NavClient from '@/components/ui/navBuses';
import { BusProvider } from '@/hooks/client/provider';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const Background = dynamic(() => import('@/components/r3f/background'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-[#07111f]" />,
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <BusProvider>
      <main className="relative min-h-screen overflow-x-hidden bg-[#07111f] text-white">
        <Background />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.14),transparent_18%),linear-gradient(180deg,rgba(2,6,23,0.22),rgba(2,6,23,0.84))]" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1800px] flex-col p-4 lg:p-6">
          <div className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <NavClient navOpen={navOpen} onClose={() => setNavOpen(false)} />

            <section className="min-w-0 rounded-4xl border border-white/10 bg-slate-950/45 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl lg:p-6">
              <Header onMenuClick={() => setNavOpen(true)} />
              <div className="mt-6">{children}</div>
            </section>
          </div>
        </div>
      </main>
    </BusProvider>
  );
}

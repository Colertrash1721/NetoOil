import ThreeClient from '@/components/r3f/threeClient';

export default function Page() {
  return (
    <main className="w-full h-screen relative">
      <ThreeClient />
      <div className="relative z-10 p-6">Hello</div>
    </main>
  );
}
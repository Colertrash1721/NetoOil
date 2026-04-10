'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Scene = dynamic(() => import('@/components/r3f/scene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 -z-10 bg-black flex items-center justify-center">
      <div className="text-white text-lg">Loading 3D Scene...</div>
    </div>
  )
});

export default function ThreeClient() {
  return (
    <div className="absolute inset-0 z-10">
      <Suspense fallback={
        <div className="w-screen h-screen bg-black flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }>
        <Scene />
      </Suspense>
    </div>
  );
}
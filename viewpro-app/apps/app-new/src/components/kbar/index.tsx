'use client';

import dynamic from 'next/dynamic';

const KBarPalette = dynamic(() => import('./palette').then((module) => module.KBarPalette), {
  ssr: false
});

export default function KBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KBarPalette />
      {children}
    </>
  );
}

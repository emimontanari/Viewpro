'use client';

import dynamic from 'next/dynamic';
import { navGroups } from '@/config/nav-config';
import type { NavGroup } from '@/types';

const KBarPalette = dynamic<{ navGroupsConfig?: NavGroup[] }>(
  () => import('./palette').then((module) => module.KBarPalette),
  {
    ssr: false
  }
);

export default function KBar({
  children,
  navGroupsConfig = navGroups
}: {
  children: React.ReactNode;
  navGroupsConfig?: NavGroup[];
}) {
  return (
    <>
      <KBarPalette navGroupsConfig={navGroupsConfig} />
      {children}
    </>
  );
}

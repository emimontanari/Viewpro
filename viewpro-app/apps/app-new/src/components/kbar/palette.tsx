'use client';

import { navGroups } from '@/config/nav-config';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarSearch,
  VisualState,
  useKBar
} from 'kbar';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { COMMAND_PALETTE_OPEN_EVENT } from './events';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';

export function KBarPalette() {
  const router = useRouter();
  const filteredGroups = useFilteredNavGroups(navGroups);

  const actions = useMemo(() => {
    const navigateTo = (url: string) => {
      router.push(url);
    };

    const allItems = filteredGroups.flatMap((group) => group.items);

    return allItems.flatMap((navItem) => {
      const baseAction =
        navItem.url !== '#'
          ? {
              id: `${navItem.title.toLowerCase()}Action`,
              name: navItem.title,
              shortcut: navItem.shortcut,
              keywords: navItem.title.toLowerCase(),
              section: 'Navigation',
              subtitle: `Go to ${navItem.title}`,
              perform: () => navigateTo(navItem.url)
            }
          : null;

      const childActions =
        navItem.items?.map((childItem) => ({
          id: `${childItem.title.toLowerCase()}Action`,
          name: childItem.title,
          shortcut: childItem.shortcut,
          keywords: childItem.title.toLowerCase(),
          section: navItem.title,
          subtitle: `Go to ${childItem.title}`,
          perform: () => navigateTo(childItem.url)
        })) ?? [];

      return baseAction ? [baseAction, ...childActions] : childActions;
    });
  }, [router, filteredGroups]);

  return (
    <KBarProvider actions={actions}>
      <KBarComponent />
    </KBarProvider>
  );
}

function KBarComponent() {
  const { query } = useKBar();

  useThemeSwitching();

  useEffect(() => {
    const openPalette = () => {
      query.setVisualState((visualState) =>
        visualState === VisualState.hidden || visualState === VisualState.animatingOut
          ? VisualState.animatingIn
          : visualState
      );
    };

    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
  }, [query]);

  return (
    <KBarPortal>
      <KBarPositioner className='bg-background/80 fixed inset-0 z-99999 p-0! backdrop-blur-sm'>
        <KBarAnimator className='bg-card text-card-foreground relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border shadow-lg'>
          <div className='bg-card border-border sticky top-0 z-10 border-b'>
            <KBarSearch className='bg-card w-full border-none px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden' />
          </div>
          <div className='max-h-[400px]'>
            <RenderResults />
          </div>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

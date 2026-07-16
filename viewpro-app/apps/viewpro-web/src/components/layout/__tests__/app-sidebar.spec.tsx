/**
 * platform-operator-management (A4, PR2) — RED: app-sidebar nav-gating spec.
 * Design Decision 6: nav items get an optional `access: { role }` check; the
 * sidebar filters `navGroupsConfig` by the current operator's role before
 * rendering. Server-side 403 remains the real enforcement — this is UX only.
 *
 * Tests cover:
 *   - An item with no `access` renders regardless of role
 *   - An item with `access: { role: 'OWNER' }` renders for an OWNER session
 *   - The same item is HIDDEN for a non-OWNER session (OPERATIONS, ANALYST)
 *   - A group that becomes fully empty after filtering renders no group label
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { NavGroup } from '@/types';

// jsdom does not implement matchMedia — the Sidebar's mobile-detection hook
// (use-mobile.tsx) needs it to mount at all.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })) as unknown as typeof window.matchMedia;
});

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: pushMock })
}));

vi.mock('@/lib/brand/brand', () => ({
  BRAND: { metadata: { appTitle: 'ViewPro' } }
}));

const mockUseSession = vi.fn();
vi.mock('@/lib/session-context', () => ({
  useSession: () => mockUseSession()
}));

import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '../app-sidebar';

function renderSidebar(navGroupsConfig: NavGroup[]) {
  return render(
    <SidebarProvider>
      <AppSidebar navGroupsConfig={navGroupsConfig} />
    </SidebarProvider>
  );
}

const GROUPS_WITH_OWNER_ONLY_ITEM: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: 'dashboard', items: [] },
      {
        title: 'Operadores',
        url: '/dashboard/operators',
        icon: 'user',
        items: [],
        access: { role: 'OWNER' }
      }
    ]
  }
];

describe('AppSidebar — nav-gating by operator role (Design Decision 6)', () => {
  it('renders an item with no `access` field regardless of role', () => {
    mockUseSession.mockReturnValue({
      session: { operator: { id: 'op-1', email: 'a@viewpro.app', role: 'ANALYST' } },
      isLoading: false,
      signOut: vi.fn()
    });

    renderSidebar(GROUPS_WITH_OWNER_ONLY_ITEM);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders an OWNER-gated item for an OWNER session', () => {
    mockUseSession.mockReturnValue({
      session: { operator: { id: 'op-1', email: 'owner@viewpro.app', role: 'OWNER' } },
      isLoading: false,
      signOut: vi.fn()
    });

    renderSidebar(GROUPS_WITH_OWNER_ONLY_ITEM);

    expect(screen.getByText('Operadores')).toBeInTheDocument();
  });

  it('hides an OWNER-gated item for an OPERATIONS session', () => {
    mockUseSession.mockReturnValue({
      session: { operator: { id: 'op-2', email: 'ops@viewpro.app', role: 'OPERATIONS' } },
      isLoading: false,
      signOut: vi.fn()
    });

    renderSidebar(GROUPS_WITH_OWNER_ONLY_ITEM);

    expect(screen.queryByText('Operadores')).toBeNull();
    // Ungated sibling still renders — proves filtering is per-item, not per-group.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('hides an OWNER-gated item for an ANALYST session (triangulation)', () => {
    mockUseSession.mockReturnValue({
      session: { operator: { id: 'op-3', email: 'analyst@viewpro.app', role: 'ANALYST' } },
      isLoading: false,
      signOut: vi.fn()
    });

    renderSidebar(GROUPS_WITH_OWNER_ONLY_ITEM);

    expect(screen.queryByText('Operadores')).toBeNull();
  });

  it('renders no group label when every item in a group is filtered out', () => {
    mockUseSession.mockReturnValue({
      session: { operator: { id: 'op-2', email: 'ops@viewpro.app', role: 'OPERATIONS' } },
      isLoading: false,
      signOut: vi.fn()
    });

    const onlyGatedGroup: NavGroup[] = [
      {
        label: 'Solo dueños',
        items: [
          {
            title: 'Operadores',
            url: '/dashboard/operators',
            icon: 'user',
            items: [],
            access: { role: 'OWNER' }
          }
        ]
      }
    ];

    renderSidebar(onlyGatedGroup);

    expect(screen.queryByText('Solo dueños')).toBeNull();
    expect(screen.queryByText('Operadores')).toBeNull();
  });
});

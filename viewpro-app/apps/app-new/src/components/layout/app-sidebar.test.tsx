import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navGroups } from '@/config/nav-config';
import { useActiveTenant, useSession } from '@/lib/session-context';
import { navigationAccessScenarios } from '@/test/navigation-access-fixtures';
import AppSidebar from './app-sidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';

let currentPathname = '/dashboard';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn(), useSession: vi.fn() }));
vi.mock('@/components/org-switcher', () => ({ OrgSwitcher: () => <div>Workspace switcher</div> }));
vi.mock('next/navigation', () => ({ usePathname: () => currentPathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('AppSidebar navigation access', () => {
  const useActiveTenantMock = vi.mocked(useActiveTenant);

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() })) });
    vi.mocked(useSession).mockReturnValue({
      session: null,
      memberships: [],
      selectedTenantId: null,
      activeMembership: null,
      activeTenantId: null,
      hasMemberships: false,
      isLoading: false,
      isTenantLoading: false,
      needsTenantSelection: false,
      isAuthenticated: false,
      signOut: vi.fn()
    });
  });

  it.each(navigationAccessScenarios)('renders the exact permitted destinations for $state', ({ activeMembership, destinations, isTenantLoading }) => {
    useActiveTenantMock.mockReturnValue({ activeMembership, activeTenantId: activeMembership.tenant.id, hasMemberships: true, isTenantLoading, memberships: [activeMembership], needsTenantSelection: false, selectedTenantId: activeMembership.tenant.id });

    render(<SidebarProvider><AppSidebar navGroupsConfig={navGroups} /></SidebarProvider>);

    expect(screen.getAllByRole('link').map((link) => ({ title: link.textContent, href: link.getAttribute('href') }))).toEqual(destinations);
  });
});

function MobilePanelOpener() {
  const { setOpenMobile } = useSidebar();
  return <button onClick={() => setOpenMobile(true)}>abrir panel</button>;
}

function renderMobileSidebar() {
  return render(
    <SidebarProvider>
      <MobilePanelOpener />
      <AppSidebar navGroupsConfig={navGroups} />
    </SidebarProvider>
  );
}

describe('AppSidebar mobile panel', () => {
  const membership = navigationAccessScenarios[0]!.activeMembership;

  beforeEach(() => {
    currentPathname = '/dashboard';
    window.innerWidth = 500;
    vi.mocked(useActiveTenant).mockReturnValue({ activeMembership: membership, activeTenantId: membership.tenant.id, hasMemberships: true, isTenantLoading: false, memberships: [membership], needsTenantSelection: false, selectedTenantId: membership.tenant.id });
  });

  it('closes after navigating to another destination', async () => {
    const { rerender } = renderMobileSidebar();

    await act(async () => { screen.getByRole('button', { name: 'abrir panel' }).click(); });
    expect(screen.getByRole('dialog')).toBeTruthy();

    currentPathname = '/dashboard/profile';
    await act(async () => {
      rerender(
        <SidebarProvider>
          <MobilePanelOpener />
          <AppSidebar navGroupsConfig={navGroups} />
        </SidebarProvider>
      );
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves the panel open while the destination does not change', async () => {
    const { rerender } = renderMobileSidebar();

    await act(async () => { screen.getByRole('button', { name: 'abrir panel' }).click(); });
    await act(async () => {
      rerender(
        <SidebarProvider>
          <MobilePanelOpener />
          <AppSidebar navGroupsConfig={navGroups} />
        </SidebarProvider>
      );
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('leaves the desktop sidebar expanded when navigating', async () => {
    window.innerWidth = 1280;
    const { container, rerender } = renderMobileSidebar();

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state')).toBe('expanded');

    currentPathname = '/dashboard/profile';
    await act(async () => {
      rerender(
        <SidebarProvider>
          <MobilePanelOpener />
          <AppSidebar navGroupsConfig={navGroups} />
        </SidebarProvider>
      );
    });

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state')).toBe('expanded');
  });
});

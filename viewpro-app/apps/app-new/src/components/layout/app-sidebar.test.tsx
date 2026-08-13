import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navGroups } from '@/config/nav-config';
import { useActiveTenant, useSession } from '@/lib/session-context';
import { navigationAccessScenarios } from '@/test/navigation-access-fixtures';
import AppSidebar from './app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn(), useSession: vi.fn() }));
vi.mock('@/components/org-switcher', () => ({ OrgSwitcher: () => <div>Workspace switcher</div> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

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

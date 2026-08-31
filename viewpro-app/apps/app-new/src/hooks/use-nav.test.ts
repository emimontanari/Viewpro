import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navGroups } from '@/config/nav-config';
import { useFilteredNavGroups } from './use-nav';

const activeTenant = vi.fn();
vi.mock('@/lib/session-context', () => ({ useActiveTenant: () => activeTenant() }));

const membership = (role: string, permissions: string[], tenantStatus = 'ACTIVE') => ({
  id: 'membership-1',
  role,
  permissions,
  tenant: { id: 'tenant-1', name: 'Agency', slug: 'agency', status: tenantStatus }
});

const MANAGER = ['tenant.view', 'team.view', 'engagements.view_all'];
const AGENT = ['tenant.view', 'engagements.view_assigned'];

const titles = (groups: ReturnType<typeof useFilteredNavGroups>) =>
  groups.flatMap((group) => group.items).map((item) => item.title);

describe('useFilteredNavGroups', () => {
  beforeEach(() => {
    activeTenant.mockReset();
  });

  it('drops the navigation a degraded role no longer reaches, on the next context', () => {
    // Criterion 6 of #307. The hook memoises on [activeMembership,
    // isTenantLoading]; a wrong dependency list would keep serving the old
    // groups after a refetch, so a demoted manager would still be offered
    // manager-only destinations until a full reload.
    activeTenant.mockReturnValue({
      activeMembership: membership('MANAGER', MANAGER),
      isTenantLoading: false
    });
    const { result, rerender } = renderHook(() => useFilteredNavGroups(navGroups));

    const asManager = titles(result.current);
    expect(asManager).toContain('Equipo');

    activeTenant.mockReturnValue({
      activeMembership: membership('AGENT', AGENT),
      isTenantLoading: false
    });
    rerender();

    expect(titles(result.current)).not.toContain('Equipo');
    expect(titles(result.current).length).toBeLessThan(asManager.length);
  });

  it('drops it when the membership disappears entirely', () => {
    // A deactivated membership does not come back from /auth/me at all, so the
    // next validated context simply has none.
    activeTenant.mockReturnValue({
      activeMembership: membership('MANAGER', MANAGER),
      isTenantLoading: false
    });
    const { result, rerender } = renderHook(() => useFilteredNavGroups(navGroups));
    expect(titles(result.current)).toContain('Equipo');

    activeTenant.mockReturnValue({ activeMembership: null, isTenantLoading: false });
    rerender();

    expect(titles(result.current)).not.toContain('Equipo');
  });

  it('drops it when the tenant stops being operational', () => {
    activeTenant.mockReturnValue({
      activeMembership: membership('MANAGER', MANAGER),
      isTenantLoading: false
    });
    const { result, rerender } = renderHook(() => useFilteredNavGroups(navGroups));
    expect(titles(result.current)).toContain('Equipo');

    activeTenant.mockReturnValue({
      activeMembership: membership('MANAGER', MANAGER, 'SUSPENDED'),
      isTenantLoading: false
    });
    rerender();

    expect(titles(result.current)).not.toContain('Equipo');
  });

  it('hides restricted navigation while the next context is still loading', () => {
    // Criterion 5, pinned here rather than assumed: during a refetch the stale
    // membership must not keep offering what it used to.
    activeTenant.mockReturnValue({
      activeMembership: membership('MANAGER', MANAGER),
      isTenantLoading: true
    });
    const { result } = renderHook(() => useFilteredNavGroups(navGroups));

    expect(titles(result.current)).not.toContain('Equipo');
  });
});

import { describe, expect, it } from 'vitest';
import { navGroups, workspaceAdministrationAccess } from '@/config/nav-config';
import {
  canAccessNavigation,
  filterNavigationGroups,
  isTenantOperational,
  toNavigationAccessContext
} from './navigation-access';

const manager = {
  resolved: true,
  membership: {
    role: 'MANAGER',
    permissions: ['engagements.view_all', 'team.view'],
    tenantStatus: 'ACTIVE'
  }
};

describe('navigation access policy', () => {
  it('keeps unrestricted navigation available without a membership', () => {
    expect(canAccessNavigation(undefined, { resolved: true, membership: null })).toBe(true);
  });

  it('requires a resolved membership for role- or permission-protected navigation', () => {
    expect(canAccessNavigation({ roles: ['MANAGER'] }, { ...manager, resolved: false })).toBe(false);
    expect(canAccessNavigation({ permissions: ['team.view'] }, { resolved: true, membership: null })).toBe(false);
  });

  it('treats an empty role allowlist as an explicit denial', () => {
    expect(canAccessNavigation({ roles: [] }, manager)).toBe(false);
  });

  it('requires both an allowed role and every permission', () => {
    const policy = { roles: ['MANAGER', 'PRINCIPAL_MANAGER'], permissions: ['team.view', 'team.manage'] };

    expect(canAccessNavigation(policy, manager)).toBe(false);
    expect(canAccessNavigation(policy, { ...manager, membership: { ...manager.membership, permissions: ['team.view', 'team.manage'] } })).toBe(true);
  });

  it('filters protected items without mutating the source groups', () => {
    const groups = [{ label: 'Workspace', items: [{ title: 'Public', url: '/public' }, { title: 'Team', url: '/team', access: { permissions: ['team.view'] } }] }];

    expect(filterNavigationGroups(groups, { resolved: false, membership: manager.membership })[0]?.items.map(({ title }) => title)).toEqual(['Public']);
    expect(groups[0]?.items.map(({ title }) => title)).toEqual(['Public', 'Team']);
  });

  it('shares immutable workspace administration access', () => {
    expect(workspaceAdministrationAccess).toEqual({ roles: ['MANAGER', 'PRINCIPAL_MANAGER'], permissions: ['team.view'] });
    expect(Object.isFrozen(workspaceAdministrationAccess)).toBe(true); expect(navGroups[0]?.items.find(({ title }) => title === 'Inmobiliarias')?.access).toBe(workspaceAdministrationAccess);
    expect(navGroups[0]?.items.find(({ title }) => title === 'Equipo')?.access).toBe(workspaceAdministrationAccess);
  });
});

describe('isTenantOperational', () => {
  it('mirrors TenantMembershipGuard: only SUSPENDED and CANCELLED are refused', () => {
    // apps/api/src/tenant-context/tenant-membership.guard.ts refuses exactly
    // these two. A UI that disagrees with the API is worse than one that does
    // not check: it either hides work the user may still do, or offers work
    // every call behind it will reject.
    expect(isTenantOperational('ACTIVE')).toBe(true);
    expect(isTenantOperational('TRIAL')).toBe(true);
    expect(isTenantOperational('SUSPENDED')).toBe(false);
    expect(isTenantOperational('CANCELLED')).toBe(false);
  });

  it('refuses an absent or unrecognised status rather than assuming it is fine', () => {
    // 'active' is the boundary most likely to happen: the lookup is
    // case-sensitive and fail-closed, so the wrong case empties the sidebar.
    for (const status of [null, undefined, '', 'WHATEVER', 'active']) {
      expect(isTenantOperational(status)).toBe(false);
    }
  });
});

const guarded = (groups: ReturnType<typeof filterNavigationGroups>) =>
  groups.flatMap((group) => group.items).filter((item) => item.access);

const context = (tenantStatus: string) => ({
  resolved: true,
  membership: { role: 'MANAGER', permissions: ['team.view'], tenantStatus }
});

describe('canAccessNavigation with a non-operational tenant', () => {
  const policy = { roles: ['MANAGER'] };

  it('hides operational navigation once the tenant is suspended or cancelled', () => {
    // The status already travels in the /auth/me payload; use-nav dropped it
    // before the policy could see it, so a suspended agency kept the whole
    // sidebar and every click behind it failed at the API.
    expect(canAccessNavigation(policy, context('SUSPENDED'))).toBe(false);
    expect(canAccessNavigation(policy, context('CANCELLED'))).toBe(false);
  });

  it('leaves an operational tenant exactly as it was', () => {
    expect(canAccessNavigation(policy, context('ACTIVE'))).toBe(true);
    expect(canAccessNavigation(policy, context('TRIAL'))).toBe(true);
  });

  it('hides everything a policy guards when the tenant is not operational', () => {
    // Asserted positively as well: with the expectation only inside a loop,
    // an empty result would have reported green and proved nothing.
    expect(guarded(filterNavigationGroups(navGroups, context('ACTIVE'))).length).toBeGreaterThan(0);
    expect(guarded(filterNavigationGroups(navGroups, context('SUSPENDED')))).toEqual([]);
  });
});

describe('toNavigationAccessContext', () => {
  const source = { role: 'MANAGER', permissions: ['team.view'], tenant: { status: 'ACTIVE' } };

  it('carries the tenant status through, which is the whole point', () => {
    // Both the sidebar and the org switcher route through this now. The defect
    // this change fixes was a caller dropping the status while projecting, so
    // the projector itself has to be pinned.
    expect(toNavigationAccessContext(source, false).membership?.tenantStatus).toBe('ACTIVE');
  });

  it('inverts the loading flag into resolved', () => {
    expect(toNavigationAccessContext(source, true).resolved).toBe(false);
    expect(toNavigationAccessContext(source, false).resolved).toBe(true);
  });

  it('passes a missing membership straight through as null', () => {
    expect(toNavigationAccessContext(null, false).membership).toBeNull();
  });

  it('degrades to fail-closed instead of throwing when the tenant is absent', () => {
    const noTenant = { role: 'MANAGER', permissions: ['team.view'] };

    expect(toNavigationAccessContext(noTenant, false).membership?.tenantStatus).toBeNull();
    expect(canAccessNavigation({ roles: ['MANAGER'] }, toNavigationAccessContext(noTenant, false))).toBe(false);
  });
});


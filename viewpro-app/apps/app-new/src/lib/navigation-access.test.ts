import { describe, expect, it } from 'vitest';
import { navGroups, workspaceAdministrationAccess } from '@/config/nav-config';
import { canAccessNavigation, filterNavigationGroups } from './navigation-access';

const manager = {
  resolved: true,
  membership: { role: 'MANAGER', permissions: ['engagements.view_all', 'team.view'] }
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

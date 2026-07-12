import { describe, expect, it, vi } from 'vitest';
import { navGroups, ownerNavGroups } from '@/config/nav-config';
import { buildNavigationActions } from './palette';

function collectNavigationActions(groups: typeof navGroups) {
  const navigateTo = vi.fn();
  const actions = buildNavigationActions(groups, navigateTo);

  for (const action of actions) {
    action.perform?.();
  }

  return {
    actionNames: actions.map((action) => action.name),
    navigationUrls: navigateTo.mock.calls.map(([url]) => url)
  };
}

function collectNavigationUrls(groups: typeof navGroups) {
  return collectNavigationActions(groups).navigationUrls;
}

describe('KBar navigation actions', () => {
  it('uses owner routes only when the owner nav config is supplied', () => {
    expect(collectNavigationUrls(ownerNavGroups)).toEqual(['/owner']);
  });

  it('keeps dashboard routes in the default dashboard nav config', () => {
    expect(collectNavigationUrls(navGroups)).toEqual(expect.arrayContaining(['/dashboard']));
  });

  it('does not expose billing actions from the default dashboard nav config', () => {
    const { actionNames, navigationUrls } = collectNavigationActions(navGroups);

    expect(actionNames).not.toContain('Facturación');
    expect(navigationUrls).not.toContain('/dashboard/billing');
  });
});

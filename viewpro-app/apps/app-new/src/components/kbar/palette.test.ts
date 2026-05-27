import { describe, expect, it, vi } from 'vitest';
import { navGroups, ownerNavGroups } from '@/config/nav-config';
import { buildNavigationActions } from './palette';

function collectNavigationUrls(groups: typeof navGroups) {
  const navigateTo = vi.fn();
  const actions = buildNavigationActions(groups, navigateTo);

  for (const action of actions) {
    action.perform?.();
  }

  return navigateTo.mock.calls.map(([url]) => url);
}

describe('KBar navigation actions', () => {
  it('uses owner routes only when the owner nav config is supplied', () => {
    expect(collectNavigationUrls(ownerNavGroups)).toEqual(['/owner']);
  });

  it('keeps dashboard routes in the default dashboard nav config', () => {
    expect(collectNavigationUrls(navGroups)).toEqual(expect.arrayContaining(['/dashboard']));
  });
});

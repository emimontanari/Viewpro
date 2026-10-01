import { createElement, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { membership, navigationAccessScenarios } from '@/test/navigation-access-fixtures';
import { KBarPalette } from './palette';

const registeredActions: { name: string; perform?: () => void }[] = [];
const push = vi.fn();

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./render-result', () => ({ default: () => null }));
vi.mock('./use-theme-switching', () => ({ default: () => undefined }));
vi.mock('kbar', () => ({
  KBarProvider: ({ actions, children }: { actions: { name: string; perform?: () => void }[]; children: ReactNode }) => {
    registeredActions.splice(0, registeredActions.length, ...actions);
    return children;
  },
  KBarPortal: ({ children }: { children: ReactNode }) => children,
  KBarPositioner: ({ children }: { children: ReactNode }) => children,
  KBarAnimator: ({ children }: { children: ReactNode }) => children,
  KBarSearch: () => null,
  VisualState: { hidden: 'hidden', animatingOut: 'animatingOut', animatingIn: 'animatingIn' },
  useKBar: () => ({ query: { setVisualState: vi.fn() } })
}));

function renderPalette(activeMembership: ReturnType<typeof membership>, isTenantLoading = false) {
  vi.mocked(useActiveTenant).mockReturnValue({ activeMembership, activeTenantId: activeMembership.tenant.id, hasMemberships: true, isTenantLoading, memberships: [activeMembership], needsTenantSelection: false, selectedTenantId: activeMembership.tenant.id });
  render(createElement(KBarPalette));
  return registeredActions;
}

describe('KBarPalette navigation access', () => {
  beforeEach(() => {
    registeredActions.splice(0, registeredActions.length);
    push.mockReset();
  });

  it.each(navigationAccessScenarios)('registers the exact permitted production actions for $state', ({ activeMembership, destinations, isTenantLoading }) => {
    const actions = renderPalette(activeMembership, isTenantLoading);

    actions.forEach((action) => action.perform?.());
    expect(actions.map(({ name }, index) => ({ title: name, href: push.mock.calls[index]?.[0] }))).toEqual(destinations);
  });

  it.each([
    ['MANAGER', 'MANAGER', ['tenant.view', 'team.view', 'engagements.view_all', 'property_proposals.review']],
    ['PRINCIPAL_MANAGER', 'PRINCIPAL_MANAGER', ['tenant.view', 'team.view', 'engagements.view_all', 'tenant.manage_settings', 'property_proposals.review']]
  ])('registers only reviewer navigation for authorized %s', (_label, role, permissions) => {
    const actions = renderPalette(membership(role, permissions));

    expect(actions.map(({ name }) => name)).toContain('Revisión de propuestas');
    const reviewerAction = actions.find(({ name }) => name === 'Revisión de propuestas');
    expect(reviewerAction?.perform).toBeDefined();
    reviewerAction?.perform?.();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/dashboard/property-proposals/review');
    expect(actions.map(({ name }) => name)).not.toContain('Propuestas de propiedades');
  });

  it.each([
    ['seller', membership('AGENT', ['tenant.view', 'property_proposals.seller'])],
    ['manager without review capability', membership('MANAGER', ['tenant.view', 'team.view', 'engagements.view_all'])],
    ['inactive reviewer', membership('MANAGER', ['tenant.view', 'property_proposals.review'], 'SUSPENDED')]
  ])('omits reviewer navigation for %s', (_label, activeMembership) => {
    const actions = renderPalette(activeMembership);

    expect(actions.map(({ name }) => name)).not.toContain('Revisión de propuestas');
  });
});

import { createElement, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { navigationAccessScenarios, type membership } from '@/test/navigation-access-fixtures';
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
});

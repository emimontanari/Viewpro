import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useActiveTenant } from '@/lib/session-context';
import { SELECTED_TENANT_COOKIE } from '@/lib/tenant-selection';
import { OrgSwitcher } from './org-switcher';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const membership = (id: string, role: string, permissions: string[] = ['team.view']) => ({
  id: `membership-${id}`,
  role,
  permissions,
  tenant: { id, name: `Agency ${id}`, slug: `agency-${id}`, status: 'ACTIVE' }
});

const agent = membership('agent', 'AGENT');
const manager = membership('manager', 'MANAGER');
const principal = membership('principal', 'PRINCIPAL_MANAGER');
const outsider = membership('outsider', 'MANAGER');

function renderSwitcher(activeMembership = agent, memberships = [agent, manager, principal], isTenantLoading = false) {
  vi.mocked(useActiveTenant).mockReturnValue({
    activeMembership,
    activeTenantId: activeMembership?.tenant.id ?? null,
    hasMemberships: memberships.length > 0,
    isTenantLoading,
    memberships,
    needsTenantSelection: false,
    selectedTenantId: activeMembership?.tenant.id ?? null
  });

  return render(<SidebarProvider><OrgSwitcher /></SidebarProvider>);
}

async function openSwitcher(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button'));
}

describe('OrgSwitcher', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() }))
    });
    window.localStorage.clear();
    document.cookie = `${SELECTED_TENANT_COOKIE}=; Path=/; Max-Age=0`;
    router.push.mockReset();
    router.refresh.mockReset();
  });

  it('renders only session memberships with exact accessible role labels and no AGENT administration action', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await openSwitcher(user);

    expect(screen.queryByText('Administrar inmobiliarias')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: `${outsider.tenant.name}, Encargado` })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Agency agent, Vendedor' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Agency manager, Encargado' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Agency principal, Encargado principal' })).toBeInTheDocument();
  });

  it.each([manager, principal])('keeps administration available for $role with the shared policy requirements', async (activeMembership) => {
    const user = userEvent.setup();
    renderSwitcher(activeMembership);
    await openSwitcher(user);

    expect(screen.getByText('Administrar inmobiliarias')).toBeInTheDocument();
  });

  it('fails closed during loading even when a privileged membership is retained', () => {
    renderSwitcher(manager, [manager], true);

    expect(screen.getByRole('button', { name: /Cargando/i })).toBeDisabled();
    expect(screen.queryByText('Administrar inmobiliarias')).not.toBeInTheDocument();
  });

  it('renders one radio group with a single checked item and its visible indicator', async () => {
    const user = userEvent.setup();
    renderSwitcher(manager);
    await openSwitcher(user);

    const radios = screen.getAllByRole('menuitemradio');
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(radios).toHaveLength(3);
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(within(screen.getByRole('menuitemradio', { name: 'Agency manager, Encargado' })).getByTestId('radio-indicator')).toBeVisible();
  });

  it('persists a keyboard Enter selection before refreshing', async () => {
    const user = userEvent.setup();
    router.refresh.mockImplementation(() => {
      expect(window.localStorage.getItem('viewpro:selected-tenant:v1')).toBe('manager');
      expect(document.cookie).toContain(`${SELECTED_TENANT_COOKIE}=manager`);
    });
    renderSwitcher(agent, [agent, manager]);
    await openSwitcher(user);

    screen.getByRole('menuitemradio', { name: 'Agency agent, Vendedor' }).focus();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('selects a session membership with Space and never exposes arbitrary tenant IDs', async () => {
    const user = userEvent.setup();
    router.refresh.mockImplementation(() => {
      expect(window.localStorage.getItem('viewpro:selected-tenant:v1')).toBe(agent.tenant.id);
      expect(document.cookie).toContain(`${SELECTED_TENANT_COOKIE}=${agent.tenant.id}`);
    });
    renderSwitcher(manager, [agent, manager]);
    await openSwitcher(user);

    screen.getByRole('menuitemradio', { name: 'Agency manager, Encargado' }).focus();
    await user.keyboard('{ArrowUp} ');

    expect(window.localStorage.getItem('viewpro:selected-tenant:v1')).toBe('agent');
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

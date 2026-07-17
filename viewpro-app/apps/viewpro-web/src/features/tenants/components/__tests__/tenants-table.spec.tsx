/**
 * TenantsTable component tests — rebuilt to the Kiranism starter DataTable
 * format (mirrors OperatorsTable): client-side sorting/filtering/pagination on
 * top of the shared DataTable / DataTableToolbar / DataTableColumnHeader /
 * DataTableFacetedFilter / DataTablePagination presentational components.
 *
 * Tests cover:
 *   - Rows render an identity cell (avatar initial + name + slug subtitle), a
 *     colored Estado badge, a colored Plan badge and a compact, contained
 *     Límites summary (the bleed fix — single truncated line, ∞ for null)
 *   - Estado badges use the Spanish labels (Activo/Trial/Suspendido/Baja)
 *   - Plan badges use the Spanish labels (Básico/Profesional/Empresa) and a
 *     muted "Sin plan" for a null plan
 *   - Sortable "Inmobiliaria" column header; "Plan"/"Límites" column headers
 *   - Toolbar: a search input filters rows by name AND slug; a faceted "Estado"
 *     filter and a faceted "Plan" filter narrow the rows; column view-options;
 *     a reset appears while a filter is active
 *   - Client-side pagination footer
 *   - Row actions dropdown ("Abrir menú") still emits onEditLimits /
 *     onStatusAction / onAssignPlan and honours the isMutating double-submit
 *     guard; CANCELLED rows expose no status actions
 *   - getTenantActions(item) → [toggle, cancel] for TRIAL/ACTIVE/SUSPENDED, [] for CANCELLED
 *   - getTrialEndLabel(...) → "Vence en X días"/"Vence en 1 día"/"Trial vencido"/"—"
 *   - TRIAL rows render the trial-end line under the Estado badge; non-TRIAL
 *     rows render no trial line regardless of trialEndsAt
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TenantListItem } from '@/features/tenants/api/types';
import { getTenantActions, getTrialEndLabel, TenantsTable } from '../tenants-table';

// platform-tenant-tracking PR2 (T-25) — the tenant name cell and the
// "Ver detalle" dropdown item both navigate to /dashboard/tenants/:id.
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/dashboard/tenants'
}));

// Radix DropdownMenu / Popover rely on pointer-capture + scrollIntoView APIs
// that jsdom does not implement; polyfill them so the menus/popovers can open
// under userEvent.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  mockRouterPush.mockClear();
});

const TRIAL_ITEM: TenantListItem = {
  id: 'tenant-0',
  name: 'Trial Co',
  slug: 'trial-co',
  status: 'TRIAL',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
  trialEndsAt: null,
  plan: null
};

const ITEMS: TenantListItem[] = [
  {
    id: 'tenant-1',
    name: 'Acme Realty',
    slug: 'acme-realty',
    status: 'ACTIVE',
    limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
    trialEndsAt: null,
    plan: 'BASICO'
  },
  {
    id: 'tenant-2',
    name: 'Beta Homes',
    slug: 'beta-homes',
    status: 'SUSPENDED',
    limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
    trialEndsAt: null,
    plan: null
  }
];

const CANCELLED_ITEM: TenantListItem = {
  id: 'tenant-3',
  name: 'Cancelled Co',
  slug: 'cancelled-co',
  status: 'CANCELLED',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
  trialEndsAt: null,
  plan: null
};

const CANCEL_ACTION = { kind: 'cancel', targetStatus: 'CANCELLED', label: 'Dar de baja' };

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

function noopAssignPlan() {
  // used as a default no-op handler where the test does not assert calls
}

function renderTable(props?: Partial<React.ComponentProps<typeof TenantsTable>>) {
  return render(
    <TenantsTable
      items={ITEMS}
      isMutating={false}
      onEditLimits={noop}
      onStatusAction={noop}
      onAssignPlan={noopAssignPlan}
      {...props}
    />
  );
}

// Opens the actions menu for a given row index (menus render in row order) and
// returns the userEvent instance for follow-up interactions.
async function openRowMenu(rowIndex: number) {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole('button', { name: 'Abrir menú' });
  await user.click(triggers[rowIndex]);
  return user;
}

describe('TenantsTable — cell rendering', () => {
  it('renders name and slug per row (identity cell)', () => {
    renderTable();

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.getByText('acme-realty')).toBeTruthy();
    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.getByText('beta-homes')).toBeTruthy();
  });

  it('renders an avatar initial per row (first letter of the name)', () => {
    renderTable();

    expect(screen.getByTestId('tenant-avatar-tenant-1').textContent).toBe('A');
    expect(screen.getByTestId('tenant-avatar-tenant-2').textContent).toBe('B');
  });

  it('renders a sortable "Inmobiliaria" column header', () => {
    renderTable();

    expect(screen.getByRole('button', { name: /Inmobiliaria/ })).toBeTruthy();
  });

  it('renders one actions trigger per row', () => {
    renderTable();

    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(2);
  });
});

describe('TenantsTable — Estado badge', () => {
  it('renders the Spanish status label per row', () => {
    renderTable();

    expect(screen.getByTestId('tenant-status-tenant-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('tenant-status-tenant-2').textContent).toMatch(/suspendido/i);
  });

  it('renders "Trial" for a TRIAL row and "Baja" for a CANCELLED row', () => {
    renderTable({ items: [TRIAL_ITEM, CANCELLED_ITEM] });

    expect(screen.getByTestId('tenant-status-tenant-0').textContent).toMatch(/trial/i);
    expect(screen.getByTestId('tenant-status-tenant-3').textContent).toMatch(/baja/i);
  });
});

describe('TenantsTable — Plan badge', () => {
  it('renders the plan label for a row with an assigned plan (D10)', () => {
    renderTable();

    expect(screen.getByTestId('tenant-plan-tenant-1').textContent).toBe('Básico');
  });

  it('renders a muted "Sin plan" for a row with no assigned plan', () => {
    renderTable();

    expect(screen.getByTestId('tenant-plan-tenant-2').textContent).toBe('Sin plan');
  });

  it('renders the "Plan" column header', () => {
    renderTable();

    expect(screen.getByRole('button', { name: /Plan/ })).toBeTruthy();
  });
});

describe('TenantsTable — Límites summary (compact + contained)', () => {
  it('renders a single compact line with the three limit values', () => {
    renderTable();

    const limits = screen.getByTestId('tenant-limits-tenant-1').textContent ?? '';
    expect(limits).toContain('10');
    expect(limits).toContain('50');
    // 1024 MB is formatted as GB (>= 1000), not the raw MB number.
    expect(limits).toMatch(/GB/);
  });

  it('constrains the cell to a single line (no wide right-aligned <dl>)', () => {
    renderTable();

    const cell = screen.getByTestId('tenant-limits-tenant-1');
    // The compact summary is a single element with a max-width + truncate — the
    // bleed fix. There is no descriptive-list (<dl>) spilling into neighbours.
    expect(cell.tagName.toLowerCase()).not.toBe('dl');
    expect(cell.className).toMatch(/truncate/);
    expect(cell.className).toMatch(/max-w/);
  });

  it('shows "∞" for each null limit value', () => {
    renderTable();

    const limits = screen.getByTestId('tenant-limits-tenant-2').textContent ?? '';
    expect((limits.match(/∞/g) ?? []).length).toBe(3);
  });
});

describe('TenantsTable — toolbar', () => {
  it('renders a search input that filters rows by name', async () => {
    const user = userEvent.setup();
    renderTable();

    const search = screen.getByPlaceholderText(/Buscar por nombre/i);
    await user.type(search, 'Beta');

    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.queryByText('Acme Realty')).toBeNull();
  });

  it('the search input also matches the slug', async () => {
    const user = userEvent.setup();
    renderTable();

    const search = screen.getByPlaceholderText(/Buscar por nombre/i);
    await user.type(search, 'acme-realty');

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.queryByText('Beta Homes')).toBeNull();
  });

  it('faceted "Estado" filter narrows the rows to the selected status', async () => {
    const user = userEvent.setup();
    renderTable();

    const toolbar = screen.getByRole('toolbar');
    await user.click(await within(toolbar).findByRole('button', { name: /Estado/ }));
    await user.click(await screen.findByRole('option', { name: /Suspendido/ }));

    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.queryByText('Acme Realty')).toBeNull();
  });

  it('faceted "Plan" filter narrows the rows to the selected plan', async () => {
    const user = userEvent.setup();
    renderTable();

    const toolbar = screen.getByRole('toolbar');
    await user.click(await within(toolbar).findByRole('button', { name: /Plan/ }));
    await user.click(await screen.findByRole('option', { name: /Básico/ }));

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.queryByText('Beta Homes')).toBeNull();
  });

  it('the faceted "Plan" filter offers a "Sin plan" option that narrows to unassigned rows', async () => {
    const user = userEvent.setup();
    renderTable();

    const toolbar = screen.getByRole('toolbar');
    await user.click(await within(toolbar).findByRole('button', { name: /Plan/ }));
    await user.click(await screen.findByRole('option', { name: /Sin plan/ }));

    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.queryByText('Acme Realty')).toBeNull();
  });

  it('exposes column view-options', () => {
    renderTable();

    const toolbar = screen.getByRole('toolbar');
    expect(within(toolbar).getByRole('button', { name: /Toggle columns/i })).toBeTruthy();
  });

  it('shows a reset control once a filter is active', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.queryByRole('button', { name: /Reset filters/i })).toBeNull();

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/i), 'Beta');

    expect(await screen.findByRole('button', { name: /Reset filters/i })).toBeTruthy();
  });
});

describe('TenantsTable — pagination footer', () => {
  it('renders the client-side pagination footer', () => {
    renderTable();

    expect(screen.getByText(/Rows per page/i)).toBeTruthy();
    expect(screen.getByText(/row\(s\) total/i)).toBeTruthy();
  });
});

describe('TenantsTable — navigation to tenant detail (platform-tenant-tracking, T-25)', () => {
  it('the tenant name is a link to /dashboard/tenants/:id', () => {
    renderTable();

    const nameLink = screen.getByRole('link', { name: 'Acme Realty' });
    expect(nameLink.getAttribute('href')).toBe('/dashboard/tenants/tenant-1');
  });

  it('each row links to its own tenant id', () => {
    renderTable();

    expect(screen.getByRole('link', { name: 'Beta Homes' }).getAttribute('href')).toBe(
      '/dashboard/tenants/tenant-2'
    );
  });

  it('opening a row menu exposes "Ver detalle" which navigates to /dashboard/tenants/:id', async () => {
    renderTable({ items: [ITEMS[0]] });

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Ver detalle' }));

    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/tenants/tenant-1');
  });
});

describe('TenantsTable — dropdown actions', () => {
  it('opening a row menu exposes "Editar límites" which emits onEditLimits(row)', async () => {
    const onEditLimits = vi.fn();
    renderTable({ onEditLimits });

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Editar límites' }));

    expect(onEditLimits).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('opening a row menu exposes "Asignar plan" which emits onAssignPlan(row)', async () => {
    const onAssignPlan = vi.fn();
    renderTable({ onAssignPlan });

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Asignar plan' }));

    expect(onAssignPlan).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('an ACTIVE row menu shows "Suspender" which emits onStatusAction(row, toggle action)', async () => {
    const onStatusAction = vi.fn();
    renderTable({ items: [ITEMS[0]], onStatusAction });

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Suspender' }));

    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], {
      kind: 'toggle',
      targetStatus: 'SUSPENDED',
      label: 'Suspender'
    });
  });

  it('a SUSPENDED row menu shows "Reactivar"', async () => {
    renderTable({ items: [ITEMS[1]] });

    await openRowMenu(0);
    expect(await screen.findByRole('menuitem', { name: 'Reactivar' })).toBeTruthy();
  });

  it('renders a destructive "Dar de baja" item that emits onStatusAction(row, cancel action)', async () => {
    const onStatusAction = vi.fn();
    renderTable({ items: [ITEMS[0]], onStatusAction });

    const user = await openRowMenu(0);
    const cancelItem = await screen.findByRole('menuitem', { name: 'Dar de baja' });
    expect(cancelItem.getAttribute('data-variant')).toBe('destructive');

    await user.click(cancelItem);
    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], CANCEL_ACTION);
  });

  it('a CANCELLED row menu shows no status-action items (only "Editar límites" / "Asignar plan")', async () => {
    renderTable({ items: [CANCELLED_ITEM] });

    await openRowMenu(0);
    expect(await screen.findByRole('menuitem', { name: 'Editar límites' })).toBeTruthy();
    expect(
      screen.queryByRole('menuitem', { name: /suspender|activar|reactivar|dar de baja/i })
    ).toBeNull();
  });

  it('isMutating={true} disables every MUTATING action item in the row menu (double-submit guard, AC6)', async () => {
    renderTable({ items: [ITEMS[0]], isMutating: true });

    await openRowMenu(0);

    // "Ver detalle" (T-25) is a read-only navigation item, not a mutation —
    // it is intentionally excluded from the double-submit guard.
    const mutatingItems = (await screen.findAllByRole('menuitem')).filter(
      (item) => item.textContent !== 'Ver detalle'
    );
    expect(mutatingItems.length).toBeGreaterThan(0);
    for (const item of mutatingItems) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('isMutating={true} still leaves "Ver detalle" enabled (navigation is not a mutation, T-25)', async () => {
    renderTable({ items: [ITEMS[0]], isMutating: true });

    await openRowMenu(0);

    const verDetalle = await screen.findByRole('menuitem', { name: 'Ver detalle' });
    expect(verDetalle.getAttribute('aria-disabled')).not.toBe('true');
  });
});

describe('TenantsTable — getTenantActions (D6)', () => {
  it('TRIAL row → [toggle(ACTIVE, "Activar"), cancel(CANCELLED, "Dar de baja")]', () => {
    expect(getTenantActions(TRIAL_ITEM)).toEqual([
      { kind: 'toggle', targetStatus: 'ACTIVE', label: 'Activar' },
      CANCEL_ACTION
    ]);
  });

  it('ACTIVE row → [toggle(SUSPENDED, "Suspender"), cancel(CANCELLED, "Dar de baja")]', () => {
    expect(getTenantActions(ITEMS[0])).toEqual([
      { kind: 'toggle', targetStatus: 'SUSPENDED', label: 'Suspender' },
      CANCEL_ACTION
    ]);
  });

  it('SUSPENDED row → [toggle(ACTIVE, "Reactivar"), cancel(CANCELLED, "Dar de baja")]', () => {
    expect(getTenantActions(ITEMS[1])).toEqual([
      { kind: 'toggle', targetStatus: 'ACTIVE', label: 'Reactivar' },
      CANCEL_ACTION
    ]);
  });

  it('CANCELLED row → []', () => {
    expect(getTenantActions(CANCELLED_ITEM)).toEqual([]);
  });
});

describe('getTrialEndLabel', () => {
  const NOW = new Date('2026-07-16T12:00:00.000Z');

  it('null trialEndsAt → "—"', () => {
    expect(getTrialEndLabel(null, NOW)).toBe('—');
  });

  it('trialEndsAt 5 days in the future → "Vence en 5 días"', () => {
    const future = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTrialEndLabel(future, NOW)).toBe('Vence en 5 días');
  });

  it('trialEndsAt exactly 1 day in the future → "Vence en 1 día" (singular, triangulation)', () => {
    const oneDay = new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTrialEndLabel(oneDay, NOW)).toBe('Vence en 1 día');
  });

  it('trialEndsAt in the past → "Trial vencido"', () => {
    const past = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(getTrialEndLabel(past, NOW)).toBe('Trial vencido');
  });

  it('trialEndsAt exactly now → "Trial vencido" (boundary, triangulation)', () => {
    expect(getTrialEndLabel(NOW.toISOString(), NOW)).toBe('Trial vencido');
  });

  it('malformed/unparseable trialEndsAt → "—" (fail safe, mirrors null)', () => {
    expect(getTrialEndLabel('not-a-date', NOW)).toBe('—');
  });
});

describe('TenantsTable — trial end line (TRIAL rows only)', () => {
  const NOW = new Date('2026-07-16T12:00:00.000Z');

  // Each `it` below sets/restores its own fake timer (setSystemTime/useRealTimers)
  // rather than a shared beforeEach/afterEach, since only 2 of the 4 tests need it.
  function withFakeNow<T>(run: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      return run();
    } finally {
      vi.useRealTimers();
    }
  }

  it('TRIAL row with a future trialEndsAt renders "Vence en X días" under the status badge', () => {
    withFakeNow(() => {
      const trialItem: TenantListItem = {
        ...TRIAL_ITEM,
        trialEndsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      };

      renderTable({ items: [trialItem] });

      expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('Vence en 3 días');
    });
  });

  it('TRIAL row with a past trialEndsAt renders "Trial vencido"', () => {
    withFakeNow(() => {
      const trialItem: TenantListItem = {
        ...TRIAL_ITEM,
        trialEndsAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
      };

      renderTable({ items: [trialItem] });

      expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('Trial vencido');
    });
  });

  it('TRIAL row with null trialEndsAt renders "—"', () => {
    renderTable({ items: [TRIAL_ITEM] });

    expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('—');
  });

  it('non-TRIAL row renders NO trial line, even when trialEndsAt is set', () => {
    const activeWithTrialEndsAt: TenantListItem = {
      ...ITEMS[0]!,
      trialEndsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    };

    renderTable({ items: [activeWithTrialEndsAt] });

    expect(screen.queryByTestId(`tenant-trial-${activeWithTrialEndsAt.id}`)).toBeNull();
  });
});

/**
 * TenantsTable component tests — @tanstack/react-table + dropdown row actions
 * (mirrors the InmoView products-table pattern).
 *
 * Tests cover:
 *   - Renders one row per item with name, slug, status badge, limits summary
 *   - "Sin límite" shown for null limit values
 *   - Rows render in the order received (no client re-sort)
 *   - Each row exposes an actions dropdown ("Abrir menú")
 *   - Opening a row's menu shows "Editar límites" + the status-based items;
 *     clicking an item emits onEditLimits(row) / onStatusAction(row, action)
 *   - The destructive "Dar de baja" item renders for every non-CANCELLED row
 *   - No status-action items (toggle or cancel) for a CANCELLED row
 *   - isMutating={true} disables every action item in the row menu
 *   - getTenantActions(item) → [toggle, cancel] for TRIAL/ACTIVE/SUSPENDED, [] for CANCELLED
 *   - getTrialEndLabel(trialEndsAt, now) → "Vence en X días"/"Vence en 1 día"/
 *     "Trial vencido"/"—"
 *   - TRIAL rows render the trial-end line under the status badge; non-TRIAL
 *     rows render no trial line regardless of trialEndsAt
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TenantListItem } from '@/features/tenants/api/types';
import { getTenantActions, getTrialEndLabel, TenantsTable } from '../tenants-table';

// Radix DropdownMenu relies on pointer-capture + scrollIntoView APIs that jsdom
// does not implement; polyfill them so the menu can open under userEvent.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const TRIAL_ITEM: TenantListItem = {
  id: 'tenant-0',
  name: 'Trial Co',
  slug: 'trial-co',
  status: 'TRIAL',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
  trialEndsAt: null
};

const ITEMS: TenantListItem[] = [
  {
    id: 'tenant-1',
    name: 'Acme Realty',
    slug: 'acme-realty',
    status: 'ACTIVE',
    limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
    trialEndsAt: null
  },
  {
    id: 'tenant-2',
    name: 'Beta Homes',
    slug: 'beta-homes',
    status: 'SUSPENDED',
    limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
    trialEndsAt: null
  }
];

const CANCELLED_ITEM: TenantListItem = {
  id: 'tenant-3',
  name: 'Cancelled Co',
  slug: 'cancelled-co',
  status: 'CANCELLED',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
  trialEndsAt: null
};

const CANCEL_ACTION = { kind: 'cancel', targetStatus: 'CANCELLED', label: 'Dar de baja' };

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

// Opens the actions menu for a given row index (menus render in row order) and
// returns the userEvent instance for follow-up interactions.
async function openRowMenu(rowIndex: number) {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole('button', { name: 'Abrir menú' });
  await user.click(triggers[rowIndex]);
  return user;
}

describe('TenantsTable — read-only rendering', () => {
  it('renders one row per item', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    expect(screen.getByTestId('tenant-row-tenant-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-row-tenant-2')).toBeTruthy();
  });

  it('renders name and slug per row', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.getByText('acme-realty')).toBeTruthy();
    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.getByText('beta-homes')).toBeTruthy();
  });

  it('renders the "Inmobiliaria" column header', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    expect(screen.getByRole('columnheader', { name: 'Inmobiliaria' })).toBeTruthy();
  });

  it('renders a status badge per row', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    expect(screen.getByTestId('tenant-status-tenant-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('tenant-status-tenant-2').textContent).toMatch(/suspendido/i);
  });

  it('renders the limits summary with 3 values', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    const limits = screen.getByTestId('tenant-limits-tenant-1').textContent ?? '';
    expect(limits).toContain('10');
    expect(limits).toContain('50');
    expect(limits).toContain('1.024');
  });

  it('shows "Sin límite" for null limit values', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    const limits = screen.getByTestId('tenant-limits-tenant-2').textContent ?? '';
    expect(limits.match(/sin límite/gi)?.length).toBe(3);
  });

  it('renders rows in the order received (server already sorts name ASC)', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    const rows = screen.getAllByTestId(/tenant-row-/);
    expect(rows[0].getAttribute('data-testid')).toBe('tenant-row-tenant-1');
    expect(rows[1].getAttribute('data-testid')).toBe('tenant-row-tenant-2');
  });
});

describe('TenantsTable — dropdown actions', () => {
  it('renders one actions trigger per row', () => {
    render(
      <TenantsTable items={ITEMS} isMutating={false} onEditLimits={noop} onStatusAction={noop} />
    );

    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(2);
  });

  it('opening a row menu exposes "Editar límites" which emits onEditLimits(row)', async () => {
    const onEditLimits = vi.fn();
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={onEditLimits}
        onStatusAction={noop}
      />
    );

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Editar límites' }));

    expect(onEditLimits).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('an ACTIVE row menu shows "Suspender" which emits onStatusAction(row, toggle action)', async () => {
    const onStatusAction = vi.fn();
    render(
      <TenantsTable
        items={[ITEMS[0]]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={onStatusAction}
      />
    );

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Suspender' }));

    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], {
      kind: 'toggle',
      targetStatus: 'SUSPENDED',
      label: 'Suspender'
    });
  });

  it('a SUSPENDED row menu shows "Reactivar"', async () => {
    render(
      <TenantsTable
        items={[ITEMS[1]]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    await openRowMenu(0);
    expect(await screen.findByRole('menuitem', { name: 'Reactivar' })).toBeTruthy();
  });

  it('renders a destructive "Dar de baja" item that emits onStatusAction(row, cancel action)', async () => {
    const onStatusAction = vi.fn();
    render(
      <TenantsTable
        items={[ITEMS[0]]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={onStatusAction}
      />
    );

    const user = await openRowMenu(0);
    const cancelItem = await screen.findByRole('menuitem', { name: 'Dar de baja' });
    expect(cancelItem.getAttribute('data-variant')).toBe('destructive');

    await user.click(cancelItem);
    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], CANCEL_ACTION);
  });

  it('an ACTIVE row menu shows both "Suspender" and "Dar de baja"', async () => {
    render(
      <TenantsTable
        items={[ITEMS[0]]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    await openRowMenu(0);
    expect(await screen.findByRole('menuitem', { name: 'Suspender' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Dar de baja' })).toBeTruthy();
  });

  it('a CANCELLED row menu shows no status-action items (only "Editar límites")', async () => {
    render(
      <TenantsTable
        items={[CANCELLED_ITEM]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    await openRowMenu(0);
    expect(await screen.findByRole('menuitem', { name: 'Editar límites' })).toBeTruthy();
    expect(
      screen.queryByRole('menuitem', { name: /suspender|activar|reactivar|dar de baja/i })
    ).toBeNull();
  });

  it('isMutating={true} disables every action item in the row menu (double-submit guard, AC6)', async () => {
    render(
      <TenantsTable items={[ITEMS[0]]} isMutating={true} onEditLimits={noop} onStatusAction={noop} />
    );

    await openRowMenu(0);

    for (const item of await screen.findAllByRole('menuitem')) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }
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

      render(
        <TenantsTable
          items={[trialItem]}
          isMutating={false}
          onEditLimits={noop}
          onStatusAction={noop}
        />
      );

      expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('Vence en 3 días');
    });
  });

  it('TRIAL row with a past trialEndsAt renders "Trial vencido"', () => {
    withFakeNow(() => {
      const trialItem: TenantListItem = {
        ...TRIAL_ITEM,
        trialEndsAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
      };

      render(
        <TenantsTable
          items={[trialItem]}
          isMutating={false}
          onEditLimits={noop}
          onStatusAction={noop}
        />
      );

      expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('Trial vencido');
    });
  });

  it('TRIAL row with null trialEndsAt renders "—"', () => {
    render(
      <TenantsTable
        items={[TRIAL_ITEM]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByTestId('tenant-trial-tenant-0').textContent).toBe('—');
  });

  it('non-TRIAL row renders NO trial line, even when trialEndsAt is set', () => {
    const activeWithTrialEndsAt: TenantListItem = {
      ...ITEMS[0]!,
      trialEndsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    };

    render(
      <TenantsTable
        items={[activeWithTrialEndsAt]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.queryByTestId(`tenant-trial-${activeWithTrialEndsAt.id}`)).toBeNull();
  });
});

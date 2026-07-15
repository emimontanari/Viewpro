/**
 * T-05 — RED: TenantsTable component tests (read-only rendering, PR1 scope)
 * T-12 — RED: actions column + isMutating guard (PR2/WU-2 scope)
 * T-16 — RED: getTenantActions + destructive "Dar de baja" button (D6)
 * Spec: Paginated Tenant List (scenario 1: renders name/slug/status/limits, name ASC);
 *   Status Toggle with Suspend Confirmation (button present); Limits Editing via Modal
 *   Dialog (edit-limits button present); Double-Submit Guard; Destructive Cancel
 *   Action; No Status Actions on a CANCELLED Row
 *
 * Tests cover:
 *   - Renders one row per item with name, slug, status badge, limits summary
 *   - "Sin límite" shown for null limit values
 *   - Rows render in the order received (no client re-sort)
 *   - "Editar límites" button per row emits onEditLimits(row) on click
 *   - getTenantActions(item) returns [toggle, cancel] for TRIAL/ACTIVE/SUSPENDED, [] for CANCELLED
 *   - Status-action buttons per row emit onStatusAction(row, action)
 *   - "Dar de baja" button renders for every non-CANCELLED row and emits the cancel action
 *   - No status-action buttons (toggle or cancel) for CANCELLED
 *   - isMutating={true} disables every button on every row
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { TenantListItem } from '@/features/tenants/api/types';
import { getTenantActions, TenantsTable } from '../tenants-table';

const TRIAL_ITEM: TenantListItem = {
  id: 'tenant-0',
  name: 'Trial Co',
  slug: 'trial-co',
  status: 'TRIAL',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
};

const ITEMS: TenantListItem[] = [
  {
    id: 'tenant-1',
    name: 'Acme Realty',
    slug: 'acme-realty',
    status: 'ACTIVE',
    limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 }
  },
  {
    id: 'tenant-2',
    name: 'Beta Homes',
    slug: 'beta-homes',
    status: 'SUSPENDED',
    limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
  }
];

const CANCELLED_ITEM: TenantListItem = {
  id: 'tenant-3',
  name: 'Cancelled Co',
  slug: 'cancelled-co',
  status: 'CANCELLED',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
};

const CANCEL_ACTION = { kind: 'cancel', targetStatus: 'CANCELLED', label: 'Dar de baja' };

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

describe('TenantsTable — read-only rendering', () => {
  it('renders one row per item', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByTestId('tenant-row-tenant-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-row-tenant-2')).toBeTruthy();
  });

  it('renders name and slug per row', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.getByText('acme-realty')).toBeTruthy();
    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.getByText('beta-homes')).toBeTruthy();
  });

  it('renders a status badge per row', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByTestId('tenant-status-tenant-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('tenant-status-tenant-2').textContent).toMatch(/suspendido/i);
  });

  it('renders the limits summary with 3 values', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    const limits = screen.getByTestId('tenant-limits-tenant-1').textContent ?? '';
    expect(limits).toContain('10');
    expect(limits).toContain('50');
    expect(limits).toContain('1.024');
  });

  it('shows "Sin límite" for null limit values', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    const limits = screen.getByTestId('tenant-limits-tenant-2').textContent ?? '';
    expect(limits.match(/sin límite/gi)?.length).toBe(3);
  });

  it('renders rows in the order received (server already sorts name ASC)', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    const rows = screen.getAllByTestId(/tenant-row-/);
    expect(rows[0].getAttribute('data-testid')).toBe('tenant-row-tenant-1');
    expect(rows[1].getAttribute('data-testid')).toBe('tenant-row-tenant-2');
  });
});

describe('TenantsTable — actions column (T-12/WU-2)', () => {
  it('renders an "Editar límites" button per row that emits onEditLimits(row)', () => {
    const onEditLimits = vi.fn();
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={onEditLimits}
        onStatusAction={noop}
      />
    );

    const buttons = screen.getAllByRole('button', { name: 'Editar límites' });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    expect(onEditLimits).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('renders a status-action button labeled "Suspender" for an ACTIVE row and emits onStatusAction(row, toggle action)', () => {
    const onStatusAction = vi.fn();
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={onStatusAction}
      />
    );

    const button = screen.getByRole('button', { name: 'Suspender' });
    fireEvent.click(button);
    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], {
      kind: 'toggle',
      targetStatus: 'SUSPENDED',
      label: 'Suspender'
    });
  });

  it('renders a status-action button labeled "Reactivar" for a SUSPENDED row', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeTruthy();
  });

  it('renders a destructive "Dar de baja" button for every non-CANCELLED row and emits onStatusAction(row, cancel action) on click', () => {
    const onStatusAction = vi.fn();
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={onStatusAction}
      />
    );

    const buttons = screen.getAllByRole('button', { name: 'Dar de baja' });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    expect(onStatusAction).toHaveBeenCalledWith(ITEMS[0], CANCEL_ACTION);
  });

  it('an ACTIVE row shows both "Suspender" and "Dar de baja" buttons', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(screen.getByRole('button', { name: 'Suspender' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeTruthy();
  });

  it('renders no status-action buttons (toggle or cancel) for a CANCELLED row', () => {
    render(
      <TenantsTable
        items={[CANCELLED_ITEM]}
        isMutating={false}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    expect(
      screen.queryByRole('button', { name: /suspender|activar|reactivar|dar de baja/i })
    ).toBeNull();
    // Edit-limits button still renders for a CANCELLED row.
    expect(screen.getByRole('button', { name: 'Editar límites' })).toBeTruthy();
  });

  it('isMutating={true} disables every action button on every row (double-submit guard, AC6)', () => {
    render(
      <TenantsTable
        items={ITEMS}
        isMutating={true}
        onEditLimits={noop}
        onStatusAction={noop}
      />
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });
});

describe('TenantsTable — getTenantActions (T-16/D6)', () => {
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

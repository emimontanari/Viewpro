/**
 * platform-operator-management (A4, PR2) — RED: OperatorsTable tests.
 * Mirrors TenantsTable's @tanstack/react-table + dropdown row-actions pattern.
 *
 * Tests cover:
 *   - Renders one row per item with email/role/status
 *   - Each row exposes an actions dropdown ("Abrir menú")
 *   - Opening a row's menu shows "Cambiar rol" + the status action, and emits
 *     onChangeRole(row) / onStatusAction(row, action)
 *   - isMutating={true} disables every action item in the row menu
 *   - getOperatorStatusAction(item): ACTIVE → {targetStatus:'SUSPENDED', label:'Suspender'},
 *     SUSPENDED → {targetStatus:'ACTIVE', label:'Reactivar'}
 *   - getOperatorRoleLabel/getOperatorStatusLabel render human labels
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { OperatorListItem } from '@/features/operators/api/types';
import { getOperatorStatusAction, OperatorsTable } from '../operators-table';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const ACTIVE_OWNER: OperatorListItem = {
  id: 'op-1',
  email: 'owner@viewpro.app',
  role: 'OWNER',
  status: 'ACTIVE',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

const SUSPENDED_ANALYST: OperatorListItem = {
  id: 'op-2',
  email: 'analyst@viewpro.app',
  role: 'ANALYST',
  status: 'SUSPENDED',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

const ITEMS: OperatorListItem[] = [ACTIVE_OWNER, SUSPENDED_ANALYST];

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

async function openRowMenu(rowIndex: number) {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole('button', { name: 'Abrir menú' });
  await user.click(triggers[rowIndex]);
  return user;
}

describe('OperatorsTable — read-only rendering', () => {
  it('renders one row per item', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getByTestId('operator-row-op-1')).toBeTruthy();
    expect(screen.getByTestId('operator-row-op-2')).toBeTruthy();
  });

  it('renders each row email', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getByText('owner@viewpro.app')).toBeTruthy();
    expect(screen.getByText('analyst@viewpro.app')).toBeTruthy();
  });

  it('renders a role badge per row', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getByTestId('operator-role-op-1').textContent).toMatch(/dueñ/i);
    expect(screen.getByTestId('operator-role-op-2').textContent).toMatch(/analista/i);
  });

  it('renders a status badge per row', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getByTestId('operator-status-op-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('operator-status-op-2').textContent).toMatch(/suspendido/i);
  });

  it('renders the "Email" column header', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeTruthy();
  });
});

describe('OperatorsTable — dropdown actions', () => {
  it('renders one actions trigger per row', () => {
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={noop} onStatusAction={noop} />);

    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(2);
  });

  it('opening a row menu exposes "Cambiar rol" which emits onChangeRole(row)', async () => {
    const onChangeRole = vi.fn();
    render(<OperatorsTable items={ITEMS} isMutating={false} onChangeRole={onChangeRole} onStatusAction={noop} />);

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Cambiar rol' }));

    expect(onChangeRole).toHaveBeenCalledWith(ACTIVE_OWNER);
  });

  it('an ACTIVE row menu shows "Suspender" which emits onStatusAction(row, {targetStatus:SUSPENDED})', async () => {
    const onStatusAction = vi.fn();
    render(
      <OperatorsTable items={[ACTIVE_OWNER]} isMutating={false} onChangeRole={noop} onStatusAction={onStatusAction} />
    );

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Suspender' }));

    expect(onStatusAction).toHaveBeenCalledWith(ACTIVE_OWNER, { targetStatus: 'SUSPENDED', label: 'Suspender' });
  });

  it('a SUSPENDED row menu shows "Reactivar" which emits onStatusAction(row, {targetStatus:ACTIVE})', async () => {
    const onStatusAction = vi.fn();
    render(
      <OperatorsTable
        items={[SUSPENDED_ANALYST]}
        isMutating={false}
        onChangeRole={noop}
        onStatusAction={onStatusAction}
      />
    );

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Reactivar' }));

    expect(onStatusAction).toHaveBeenCalledWith(SUSPENDED_ANALYST, { targetStatus: 'ACTIVE', label: 'Reactivar' });
  });

  it('isMutating={true} disables every action item in the row menu (double-submit guard)', async () => {
    render(<OperatorsTable items={[ACTIVE_OWNER]} isMutating={true} onChangeRole={noop} onStatusAction={noop} />);

    await openRowMenu(0);

    for (const item of await screen.findAllByRole('menuitem')) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }
  });
});

describe('getOperatorStatusAction', () => {
  it('ACTIVE → {targetStatus:"SUSPENDED", label:"Suspender"}', () => {
    expect(getOperatorStatusAction(ACTIVE_OWNER)).toEqual({ targetStatus: 'SUSPENDED', label: 'Suspender' });
  });

  it('SUSPENDED → {targetStatus:"ACTIVE", label:"Reactivar"} (triangulation)', () => {
    expect(getOperatorStatusAction(SUSPENDED_ANALYST)).toEqual({ targetStatus: 'ACTIVE', label: 'Reactivar' });
  });
});

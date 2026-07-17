/**
 * platform-operator-management (A4) — OperatorsTable, rebuilt to the Kiranism
 * starter DataTable format (client-side sorting/filtering/pagination on top of
 * the shared DataTable / DataTableToolbar / DataTableColumnHeader /
 * DataTableFacetedFilter / DataTablePagination presentational components).
 *
 * Tests cover:
 *   - Rows render email (with an avatar initial), a Rol badge, an Estado badge
 *     and a formatted "Alta" date
 *   - Sortable "Operador" column header
 *   - Toolbar: a search input filters rows by email; a faceted "Rol" filter
 *     narrows the rows; a faceted "Estado" filter and column view-options exist;
 *     a reset appears while a filter is active
 *   - Client-side pagination footer
 *   - Row actions dropdown ("Abrir menú") still emits onChangeRole /
 *     onStatusAction and honours the isMutating double-submit guard
 *   - getOperatorStatusAction(item) mapping (ACTIVE↔SUSPENDED)
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  createdAt: '2026-07-16T12:00:00.000Z',
  updatedAt: '2026-07-16T12:00:00.000Z'
};

const SUSPENDED_ANALYST: OperatorListItem = {
  id: 'op-2',
  email: 'analyst@viewpro.app',
  role: 'ANALYST',
  status: 'SUSPENDED',
  createdAt: '2026-07-16T12:00:00.000Z',
  updatedAt: '2026-07-16T12:00:00.000Z'
};

const ITEMS: OperatorListItem[] = [ACTIVE_OWNER, SUSPENDED_ANALYST];

function noop() {
  // default no-op handler where the test does not assert calls
}

function renderTable(props?: Partial<React.ComponentProps<typeof OperatorsTable>>) {
  return render(
    <OperatorsTable
      items={ITEMS}
      isMutating={false}
      onChangeRole={noop}
      onStatusAction={noop}
      {...props}
    />
  );
}

async function openRowMenu(rowIndex: number) {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole('button', { name: 'Abrir menú' });
  await user.click(triggers[rowIndex]);
  return user;
}

describe('OperatorsTable — cell rendering', () => {
  it('renders each row email', () => {
    renderTable();

    expect(screen.getByText('owner@viewpro.app')).toBeTruthy();
    expect(screen.getByText('analyst@viewpro.app')).toBeTruthy();
  });

  it('renders an avatar initial per row (first letter of the email)', () => {
    renderTable();

    expect(screen.getByTestId('operator-avatar-op-1').textContent).toBe('O');
    expect(screen.getByTestId('operator-avatar-op-2').textContent).toBe('A');
  });

  it('renders a Rol badge per row with the Spanish label', () => {
    renderTable();

    expect(screen.getByTestId('operator-role-op-1').textContent).toMatch(/dueñ/i);
    expect(screen.getByTestId('operator-role-op-2').textContent).toMatch(/analista/i);
  });

  it('renders an Estado badge per row with the Spanish label', () => {
    renderTable();

    expect(screen.getByTestId('operator-status-op-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('operator-status-op-2').textContent).toMatch(/suspendido/i);
  });

  it('renders the "Alta" date formatted (es-AR)', () => {
    renderTable();

    expect(screen.getAllByText('16/07/2026').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a sortable "Operador" column header', () => {
    renderTable();

    expect(screen.getByRole('button', { name: /Operador/ })).toBeTruthy();
  });
});

describe('OperatorsTable — toolbar', () => {
  it('renders a search input that filters rows by email', async () => {
    const user = userEvent.setup();
    renderTable();

    const search = screen.getByPlaceholderText(/Buscar por email/i);
    await user.type(search, 'analyst');

    expect(screen.getByText('analyst@viewpro.app')).toBeTruthy();
    expect(screen.queryByText('owner@viewpro.app')).toBeNull();
  });

  it('faceted "Rol" filter narrows the rows to the selected role', async () => {
    const user = userEvent.setup();
    renderTable();

    // Scope to the toolbar: the sortable column header and the faceted filter
    // both expose a "Rol" button, so disambiguate by container.
    const toolbar = screen.getByRole('toolbar');
    await user.click(await within(toolbar).findByRole('button', { name: /Rol/ }));
    await user.click(await screen.findByRole('option', { name: /Dueño/ }));

    expect(screen.getByText('owner@viewpro.app')).toBeTruthy();
    expect(screen.queryByText('analyst@viewpro.app')).toBeNull();
  });

  it('exposes a faceted "Estado" filter and column view-options', async () => {
    renderTable();

    const toolbar = screen.getByRole('toolbar');
    expect(await within(toolbar).findByRole('button', { name: /Estado/ })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: /Toggle columns/i })).toBeTruthy();
  });

  it('shows a reset control once a filter is active', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.queryByRole('button', { name: /Reset filters/i })).toBeNull();

    await user.type(screen.getByPlaceholderText(/Buscar por email/i), 'analyst');

    expect(await screen.findByRole('button', { name: /Reset filters/i })).toBeTruthy();
  });
});

describe('OperatorsTable — pagination footer', () => {
  it('renders the client-side pagination footer', () => {
    renderTable();

    expect(screen.getByText(/Rows per page/i)).toBeTruthy();
    expect(screen.getByText(/row\(s\) total/i)).toBeTruthy();
  });
});

describe('OperatorsTable — dropdown actions', () => {
  it('renders one actions trigger per row', () => {
    renderTable();

    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(2);
  });

  it('opening a row menu exposes "Cambiar rol" which emits onChangeRole(row)', async () => {
    const onChangeRole = vi.fn();
    renderTable({ onChangeRole });

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Cambiar rol' }));

    expect(onChangeRole).toHaveBeenCalledWith(ACTIVE_OWNER);
  });

  it('an ACTIVE row menu shows "Suspender" which emits onStatusAction(row, {targetStatus:SUSPENDED})', async () => {
    const onStatusAction = vi.fn();
    render(
      <OperatorsTable
        items={[ACTIVE_OWNER]}
        isMutating={false}
        onChangeRole={noop}
        onStatusAction={onStatusAction}
      />
    );

    const user = await openRowMenu(0);
    await user.click(await screen.findByRole('menuitem', { name: 'Suspender' }));

    expect(onStatusAction).toHaveBeenCalledWith(ACTIVE_OWNER, {
      targetStatus: 'SUSPENDED',
      label: 'Suspender'
    });
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

    expect(onStatusAction).toHaveBeenCalledWith(SUSPENDED_ANALYST, {
      targetStatus: 'ACTIVE',
      label: 'Reactivar'
    });
  });

  it('isMutating={true} disables every action item in the row menu (double-submit guard)', async () => {
    render(
      <OperatorsTable
        items={[ACTIVE_OWNER]}
        isMutating={true}
        onChangeRole={noop}
        onStatusAction={noop}
      />
    );

    await openRowMenu(0);

    for (const item of await screen.findAllByRole('menuitem')) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }
  });
});

describe('getOperatorStatusAction', () => {
  it('ACTIVE → {targetStatus:"SUSPENDED", label:"Suspender"}', () => {
    expect(getOperatorStatusAction(ACTIVE_OWNER)).toEqual({
      targetStatus: 'SUSPENDED',
      label: 'Suspender'
    });
  });

  it('SUSPENDED → {targetStatus:"ACTIVE", label:"Reactivar"} (triangulation)', () => {
    expect(getOperatorStatusAction(SUSPENDED_ANALYST)).toEqual({
      targetStatus: 'ACTIVE',
      label: 'Reactivar'
    });
  });
});
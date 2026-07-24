/**
 * Slice 4 (Phase 4), task 4.1 — RED: AuditFilterBar component tests.
 * Spec: platform-audit-feed — "Server-driven filter bar" requirement,
 * Scenario: "Changing the action filter".
 */
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuditFilterBar } from '../audit-filter-bar';
import { EMPTY_FILTER_VALUES, type AuditFilterValues } from '../audit-filters';

function setup(overrides: Partial<AuditFilterValues> = {}, hasActiveFilters = false) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <AuditFilterBar
      values={{ ...EMPTY_FILTER_VALUES, ...overrides }}
      onChange={onChange}
      onClear={onClear}
      hasActiveFilters={hasActiveFilters}
    />
  );
  return { onChange, onClear };
}

describe('AuditFilterBar — action filter (Scenario: changing the action filter)', () => {
  it('selecting an action option calls onChange with the action patch', async () => {
    const { onChange } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Acción' }));
    await user.click(await screen.findByRole('option', { name: 'Operador suspendido' }));

    expect(onChange).toHaveBeenCalledWith({ action: 'OPERATOR_SUSPENDED' });
  });

  it('selecting "Todas las acciones" clears the action filter', async () => {
    const { onChange } = setup({ action: 'OPERATOR_SUSPENDED' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Acción' }));
    await user.click(await screen.findByRole('option', { name: 'Todas las acciones' }));

    expect(onChange).toHaveBeenCalledWith({ action: '' });
  });
});

describe('AuditFilterBar — source filter', () => {
  it('selecting a source option calls onChange with the source patch', async () => {
    const { onChange } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Origen' }));
    await user.click(await screen.findByRole('option', { name: 'ViewPro' }));

    expect(onChange).toHaveBeenCalledWith({ source: 'VIEWPRO_NATIVE' });
  });
});

describe('AuditFilterBar — text inputs', () => {
  it('typing a tenant id calls onChange with the tenantId patch', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('Inmobiliaria (ID)'), { target: { value: 't-123' } });

    expect(onChange).toHaveBeenCalledWith({ tenantId: 't-123' });
  });

  it('typing an actor id calls onChange with the actorId patch', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('Operador/usuario (ID)'), {
      target: { value: 'a-456' }
    });

    expect(onChange).toHaveBeenCalledWith({ actorId: 'a-456' });
  });
});

describe('AuditFilterBar — date range', () => {
  it('picking dateFrom/dateTo calls onChange with the raw date-only values (the exclusive-end shift happens at fetch time, not here)', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-07-01' } });
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-07-01' });

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-07-15' } });
    expect(onChange).toHaveBeenCalledWith({ dateTo: '2026-07-15' });
  });
});

describe('AuditFilterBar — clear filters affordance', () => {
  it('the clear-filters button is disabled when there are no active filters', () => {
    setup({}, false);

    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeDisabled();
  });

  it('the clear-filters button is enabled and calls onClear when active filters exist', () => {
    const { onClear } = setup({ tenantId: 't-1' }, true);

    const button = screen.getByRole('button', { name: /limpiar filtros/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

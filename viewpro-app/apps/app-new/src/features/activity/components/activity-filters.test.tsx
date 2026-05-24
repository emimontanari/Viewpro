import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityFilters } from './activity-filters';
import type { ActivityKindFilter } from '../api/types';

type ActivityFiltersProps = Parameters<typeof ActivityFilters>[0];

function renderActivityFilters(overrides: Partial<ActivityFiltersProps> = {}) {
  const props: ActivityFiltersProps = {
    assignableAgents: [],
    dateFrom: null,
    dateTo: null,
    hasFilters: false,
    isLoadingAgents: false,
    kind: 'all',
    sellerId: null,
    type: undefined,
    onClearFilters: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onKindChange: vi.fn(),
    onSellerChange: vi.fn(),
    onTypeChange: vi.fn(),
    ...overrides
  };

  return {
    props,
    user: userEvent.setup(),
    ...render(<ActivityFilters {...props} />)
  };
}

describe('ActivityFilters', () => {
  it('renders activity kind buttons with icons and selected state', () => {
    renderActivityFilters({ kind: 'all' });

    const expectedButtons: Array<{ label: string; pressed: boolean }> = [
      { label: 'Todo', pressed: true },
      { label: 'Movimientos', pressed: false },
      { label: 'Documentos', pressed: false }
    ];

    for (const expectedButton of expectedButtons) {
      const button = screen.getByRole('button', { name: expectedButton.label });
      expect(button).toHaveAttribute('aria-pressed', String(expectedButton.pressed));
      expect(button.querySelector('svg')).toBeInTheDocument();
    }
  });

  it.each([
    ['Movimientos', 'movement'],
    ['Documentos', 'document_request']
  ] as Array<[string, ActivityKindFilter]>)('notifies kind changes for %s', async (label, kind) => {
    const { props, user } = renderActivityFilters();

    await user.click(screen.getByRole('button', { name: label }));

    expect(props.onKindChange).toHaveBeenCalledWith(kind);
  });

  it('disables movement type filtering while document requests are selected', () => {
    renderActivityFilters({ kind: 'document_request' });

    expect(screen.getByRole('combobox', { name: /tipo de actualización/i })).toBeDisabled();
    expect(screen.getByText('El tipo de actualización aplica sólo a movimientos.')).toBeVisible();
  });

  it('only shows the clear filters action when filters are active', async () => {
    const { props, rerender, user } = renderActivityFilters({ hasFilters: false });

    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument();

    rerender(<ActivityFilters {...props} hasFilters />);
    await user.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });
});

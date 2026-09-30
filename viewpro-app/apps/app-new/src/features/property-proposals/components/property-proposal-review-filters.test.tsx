import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as service from '../api/service';
import { PropertyProposalReviewInbox } from './property-proposal-review-inbox';

vi.mock('../api/service', () => ({ listReviewerPropertyProposals: vi.fn() }));

const listReviewerPropertyProposals = vi.mocked(service.listReviewerPropertyProposals);

function renderInbox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  listReviewerPropertyProposals.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  return render(<PropertyProposalReviewInbox tenantId='tenant-1' enabled />, { wrapper });
}

describe('PropertyProposalReviewInbox filters', () => {
  it('exposes only supported state and history filter choices', async () => {
    renderInbox();
    const state = await screen.findByRole('combobox', { name: 'Estado' });
    const history = screen.getByRole('combobox', { name: 'Historial' });

    expect(Array.from(state.querySelectorAll('option')).map((option) => option.value)).toEqual([
      'BORRADOR',
      'EN_REVISION',
      'APROBADA',
      'RECHAZADA'
    ]);
    expect(Array.from(history.querySelectorAll('option')).map((option) => option.value)).toEqual([
      '',
      'NONE',
      'PENDING',
      'REJECTED',
      'APPROVED'
    ]);
  });
});

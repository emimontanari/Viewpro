import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as service from '../api/service';
import { reviewerPropertyProposalsOptions } from '../api/queries';
import { PropertyProposalReviewInbox } from './property-proposal-review-inbox';

vi.mock('../api/service', () => ({ listReviewerPropertyProposals: vi.fn() }));

const listReviewerPropertyProposals = vi.mocked(service.listReviewerPropertyProposals);
const proposal = {
  id: 'proposal-1',
  state: 'EN_REVISION' as const,
  version: 1,
  title: 'Casa del lago',
  latestSubmittedAt: '2026-09-10',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-10',
  proposedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' }
};

function renderInbox(enabled = true, tenantId = 'tenant-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return {
    client,
    ...render(<PropertyProposalReviewInbox tenantId={tenantId} enabled={enabled} />, { wrapper })
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PropertyProposalReviewInbox', () => {
  it('uses the pending-first reviewer query and renders localized status with proposer display only', async () => {
    const user = userEvent.setup();
    listReviewerPropertyProposals
      .mockResolvedValueOnce({ items: [proposal], total: 40, page: 1, pageSize: 20 })
      .mockResolvedValueOnce({ items: [proposal], total: 40, page: 2, pageSize: 20 });
    renderInbox();

    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenCalledWith(
        { state: 'EN_REVISION', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    expect(await screen.findByText('Casa del lago')).toBeVisible();
    expect(screen.getByText('Sofía Vendedora')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('EN REVISIÓN');
    expect(screen.queryByText('seller-1')).toBeNull();
    expect(screen.getByRole('link', { name: 'Casa del lago' })).toHaveAttribute(
      'href',
      '/dashboard/property-proposals/review/proposal-1'
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('EN_REVISION');
    expect(screen.getByRole('combobox', { name: 'Historial' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: /aprobar|rechazar/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'EN_REVISION', page: 2, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    const next = screen.getByRole('button', { name: 'Siguiente' });
    expect(next).toBeDisabled();
    await user.click(next);
    expect(listReviewerPropertyProposals).toHaveBeenCalledTimes(2);
  });

  it('combines state and history filters, defaults to pending without history restriction, and resets pagination', async () => {
    const user = userEvent.setup();
    listReviewerPropertyProposals
      .mockResolvedValueOnce({ items: [proposal], total: 40, page: 1, pageSize: 20 })
      .mockResolvedValueOnce({ items: [proposal], total: 40, page: 2, pageSize: 20 })
      .mockResolvedValue({ items: [proposal], total: 40, page: 1, pageSize: 20 });
    renderInbox();

    expect(await screen.findByRole('combobox', { name: 'Estado' })).toHaveValue('EN_REVISION');
    expect(screen.getByRole('combobox', { name: 'Historial' })).toHaveValue('');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'EN_REVISION', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(screen.getByText('Página 2')).toBeVisible());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Historial' }), 'NONE');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'EN_REVISION', history: 'NONE', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    expect(screen.getByText('Página 1')).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'RECHAZADA');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'RECHAZADA', history: 'NONE', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Historial' }), 'REJECTED');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'RECHAZADA', history: 'REJECTED', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    expect(screen.getByText('Página 1')).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Historial' }), 'APPROVED');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'RECHAZADA', history: 'APPROVED', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Historial' }), 'PENDING');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'RECHAZADA', history: 'PENDING', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Historial' }), '');
    await waitFor(() =>
      expect(listReviewerPropertyProposals).toHaveBeenLastCalledWith(
        { state: 'RECHAZADA', page: 1, pageSize: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it('does not query while access is disabled and uses bounded loading, empty, and generic error states', async () => {
    const { client } = renderInbox(false);
    act(() =>
      client.setQueryData(reviewerPropertyProposalsOptions('tenant-1').queryKey, {
        items: [proposal],
        total: 1,
        page: 1,
        pageSize: 20
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listReviewerPropertyProposals).not.toHaveBeenCalled();
    expect(screen.queryByText('Casa del lago')).toBeNull();

    cleanup();
    let resolve!: (value: {
      items: (typeof proposal)[];
      total: number;
      page: number;
      pageSize: number;
    }) => void;
    listReviewerPropertyProposals.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderInbox();
    expect(screen.getByText('Cargando propuestas para revisar…')).toBeVisible();
    resolve({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(await screen.findByText('No hay propuestas para revisar.')).toBeVisible();

    cleanup();
    listReviewerPropertyProposals.mockRejectedValueOnce(new Error('hostile backend prose'));
    renderInbox();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las propuestas.'
    );
    expect(screen.queryByText('hostile backend prose')).toBeNull();
  });
});

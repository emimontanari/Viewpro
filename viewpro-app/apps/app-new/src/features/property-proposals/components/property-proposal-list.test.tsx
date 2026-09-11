import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from '../api/service';
import { propertyProposalKeys } from '../api/queries';
import { PropertyProposalList } from './property-proposal-list';

vi.mock('../api/service', () => ({ listSellerPropertyProposals: vi.fn() }));

const listSellerPropertyProposals = vi.mocked(service.listSellerPropertyProposals);
const proposal = {
  id: 'proposal-1', state: 'EN_REVISION' as const, version: 1, title: 'Casa del lago',
  latestSubmittedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-02'
};

function renderList(enabled = true, tenantId = 'tenant-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, ...render(<PropertyProposalList tenantId={tenantId} enabled={enabled} />, { wrapper }) };
}

describe('PropertyProposalList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the active tenant query options only when exact seller access enables it', async () => {
    listSellerPropertyProposals.mockResolvedValue({ items: [proposal], total: 1, page: 1, pageSize: 20 });
    const { client } = renderList(true, 'tenant-active');

    await waitFor(() => expect(listSellerPropertyProposals).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 }, expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    await waitFor(() => expect(screen.getByText('Casa del lago')).toBeVisible());
    expect(client.getQueryData(propertyProposalKeys.list('tenant-active', 'seller', { page: 1, pageSize: 20 }))).toEqual({
      items: [proposal], total: 1, page: 1, pageSize: 20
    });
    expect(screen.getByRole('status')).toHaveTextContent('EN REVISIÓN');
  });

  it('does not start a seller query when access is unresolved, denied, or lacks a tenant', async () => {
    renderList(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listSellerPropertyProposals).not.toHaveBeenCalled();
  });

  it('renders bounded loading, safe error, empty, data, and new-proposal states without raw error prose', async () => {
    let resolve!: (value: { items: typeof proposal[]; total: number; page: number; pageSize: number }) => void;
    listSellerPropertyProposals.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderList();
    expect(screen.getByText('Cargando propuestas…')).toBeVisible();
    resolve({ items: [], total: 0, page: 1, pageSize: 20 });
    await waitFor(() => expect(screen.getByText('Todavía no creaste propuestas.')).toBeVisible());
    expect(screen.getByRole('link', { name: 'Crear propuesta' })).toHaveAttribute('href', '/dashboard/property-proposals/new');

    listSellerPropertyProposals.mockRejectedValueOnce(new Error('hostile backend prose'));
    renderList();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las propuestas.'));
    expect(screen.queryByText('hostile backend prose')).toBeNull();
  });

  it('does not emit a detail link before the U19 detail route exists', async () => {
    listSellerPropertyProposals.mockResolvedValue({ items: [proposal], total: 1, page: 1, pageSize: 20 });
    renderList();
    await waitFor(() => expect(screen.getByText('Casa del lago')).toBeVisible());
    expect(screen.queryByRole('link', { name: 'Casa del lago' })).toBeNull();
    expect(screen.queryByRole('link', { name: /detalle/i })).toBeNull();
  });
});

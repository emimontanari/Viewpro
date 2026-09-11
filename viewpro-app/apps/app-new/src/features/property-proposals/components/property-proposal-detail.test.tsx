import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import * as service from '../api/service';
import type { PropertyProposalSnapshot, SellerPropertyProposalDetail } from '../api/types';
import { PropertyProposalDetail } from './property-proposal-detail';

vi.mock('../api/service', () => ({
  getSellerPropertyProposal: vi.fn(),
  submitSellerPropertyProposal: vi.fn(),
  updateSellerPropertyProposal: vi.fn()
}));

const getSellerPropertyProposal = vi.mocked(service.getSellerPropertyProposal);
const submitSellerPropertyProposal = vi.mocked(service.submitSellerPropertyProposal);
const updateSellerPropertyProposal = vi.mocked(service.updateSellerPropertyProposal);
const snapshot: PropertyProposalSnapshot = {
  title: 'Snapshot nuevo',
  addressLine: 'Calle 2',
  city: 'Córdoba',
  province: 'Córdoba',
  propertyType: 'HOUSE',
  operationType: 'SALE',
  totalAreaSqm: null,
  coveredAreaSqm: null,
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  garages: null,
  ageYears: null,
  orientation: null,
  ownerName: null,
  ownerEmail: null,
  publishedPriceCents: null,
  currency: null
};

const history = [
  {
    id: 'round-2',
    roundNumber: 2,
    submittedAt: '2026-09-05T12:00:00.000Z',
    submittedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
    snapshot,
    decision: null
  },
  {
    id: 'round-1',
    roundNumber: 1,
    submittedAt: '2026-09-04T12:00:00.000Z',
    submittedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
    snapshot: { ...snapshot, title: 'Snapshot anterior' },
    decision: null
  }
] as const;

function proposal(
  overrides: Partial<SellerPropertyProposalDetail> = {}
): SellerPropertyProposalDetail {
  return {
    id: 'proposal-1',
    state: 'BORRADOR',
    version: 2,
    title: 'Casa staged',
    currentReviewRoundId: 'round-2',
    canonicalEngagementId: undefined,
    latestSubmittedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-02',
    addressLine: 'Calle actual 123',
    city: 'Villa Allende',
    province: 'Córdoba',
    propertyType: 'HOUSE',
    operationType: 'SALE',
    totalAreaSqm: 120,
    coveredAreaSqm: 95,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    garages: 1,
    ageYears: 8,
    orientation: 'Norte',
    ownerName: 'Ana',
    ownerEmail: 'ana@example.com',
    publishedPriceCents: 12500000,
    currency: 'ARS',
    history: [...history],
    ...overrides
  };
}

function renderDetail(enabled = true, tenantId = 'tenant-1', proposalId = 'proposal-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(
    <PropertyProposalDetail tenantId={tenantId} proposalId={proposalId} enabled={enabled} />,
    { wrapper }
  );
}

describe('PropertyProposalDetail', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not start its seller detail query until the authorized boundary enables it', async () => {
    renderDetail(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSellerPropertyProposal).not.toHaveBeenCalled();
  });

  it('renders bounded loading, safe error, and absence states without backend prose', async () => {
    let resolve!: (value: SellerPropertyProposalDetail) => void;
    getSellerPropertyProposal.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderDetail();
    expect(screen.getByText('Cargando propuesta…')).toBeVisible();
    resolve(proposal());
    await waitFor(() => expect(screen.getByText('Casa staged')).toBeVisible());

    getSellerPropertyProposal.mockRejectedValueOnce(
      new BffError(404, 'PROPERTY_PROPOSAL_NOT_FOUND')
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('No encontramos esta propuesta.')).toBeVisible());

    getSellerPropertyProposal.mockRejectedValueOnce(new Error('hostile backend prose'));
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la propuesta.')
    );
    expect(screen.queryByText('hostile backend prose')).toBeNull();
  });

  it.each([
    ['BORRADOR', 'BORRADOR'],
    ['EN_REVISION', 'EN REVISIÓN'],
    ['APROBADA', 'APROBADA'],
    ['RECHAZADA', 'RECHAZADA']
  ] as const)(
    'renders staged read-only fields, %s state, and immutable newest-first history',
    async (state, label) => {
      getSellerPropertyProposal.mockResolvedValueOnce(proposal({ state }));
      const { container } = renderDetail();
      await waitFor(() => expect(screen.getAllByRole('status')[0]).toHaveTextContent(label));
      expect(getSellerPropertyProposal).toHaveBeenCalledWith(
        'proposal-1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      for (const value of [
        'Casa staged',
        'Calle actual 123',
        'Villa Allende',
        'Córdoba',
        'HOUSE',
        'SALE',
        'Norte',
        'ana@example.com'
      ])
        expect(screen.getAllByText(value).length).toBeGreaterThan(0);
      expect(
        screen
          .getAllByRole('heading', { level: 3 })
          .filter((heading) => heading.textContent?.startsWith('Ronda'))
          .map((heading) => heading.textContent)
      ).toEqual(['Ronda 2', 'Ronda 1']);
      const editable = state === 'BORRADOR' || state === 'RECHAZADA';
      expect(within(container).queryAllByRole('button')).toHaveLength(editable ? 2 : 0);
      expect(container.querySelectorAll('form, input, select, textarea')).toHaveLength(
        editable ? 7 : 0
      );
      expect(container.querySelectorAll('img')).toHaveLength(0);
    }
  );

  it('keeps rejected edits staged until an explicit resubmit and refetches authoritative detail on conflict', async () => {
    const user = userEvent.setup();
    getSellerPropertyProposal
      .mockResolvedValueOnce(proposal({ state: 'RECHAZADA', version: 7 }))
      .mockResolvedValueOnce(
        proposal({ state: 'RECHAZADA', version: 8, title: 'Casa actualizada' })
      );
    updateSellerPropertyProposal.mockRejectedValueOnce(
      new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
    );
    const view = renderDetail();

    await screen.findByText('Casa staged');
    expect(
      screen.getByText('Guardá los cambios y reenviá a revisión solo cuando estés lista.')
    ).toBeVisible();
    await user.clear(screen.getByLabelText('Título'));
    await user.type(screen.getByLabelText('Título'), 'Cambio local');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'La propuesta cambió. Actualizá e intentá nuevamente.'
      )
    );
    await waitFor(() => expect(getSellerPropertyProposal).toHaveBeenCalledTimes(2));
    expect(updateSellerPropertyProposal).toHaveBeenCalledWith(
      'proposal-1',
      expect.objectContaining({ expectedVersion: 7, title: 'Cambio local' })
    );
    expect(submitSellerPropertyProposal).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Casa actualizada' })).toBeVisible();
    expect(screen.getByLabelText('Título')).toHaveValue('Casa actualizada');
    view.rerender(<PropertyProposalDetail tenantId='tenant-1' proposalId='proposal-1' enabled />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La propuesta cambió. Actualizá e intentá nuevamente.'
    );

    updateSellerPropertyProposal.mockResolvedValueOnce(
      proposal({ state: 'RECHAZADA', version: 9, title: 'Casa actualizada' })
    );
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(updateSellerPropertyProposal).toHaveBeenCalledTimes(2));
    expect(updateSellerPropertyProposal).toHaveBeenLastCalledWith(
      'proposal-1',
      expect.objectContaining({ expectedVersion: 8, title: 'Casa actualizada' })
    );
    expect(submitSellerPropertyProposal).not.toHaveBeenCalled();
  });

  it('links only a nonblank approved canonical result through the encoded existing product route', async () => {
    getSellerPropertyProposal.mockResolvedValueOnce(
      proposal({ state: 'APROBADA', canonicalEngagementId: 'engagement/a b' })
    );
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Ver propiedad aprobada' })).toHaveAttribute(
      'href',
      '/dashboard/product/engagement%2Fa%20b'
    );

    cleanup();
    getSellerPropertyProposal.mockResolvedValueOnce(
      proposal({ state: 'BORRADOR', canonicalEngagementId: 'engagement-1' })
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Casa staged')).toBeVisible());
    expect(screen.queryByRole('link', { name: 'Ver propiedad aprobada' })).toBeNull();

    cleanup();
    getSellerPropertyProposal.mockResolvedValueOnce(
      proposal({ state: 'APROBADA', canonicalEngagementId: '   ' })
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Casa staged')).toBeVisible());
    expect(screen.queryByRole('link', { name: 'Ver propiedad aprobada' })).toBeNull();
  });
});

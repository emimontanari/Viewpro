import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import * as service from '../api/service';
import type { ReviewerPropertyProposalDetail } from '../api/types';
import { PropertyProposalReviewDetail } from './property-proposal-review-detail';
vi.mock('../api/service', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/service')>(),
  getReviewerPropertyProposal: vi.fn(),
  rejectReviewerPropertyProposal: vi.fn()
}));
const getDetail = vi.mocked(service.getReviewerPropertyProposal);
const reject = vi.mocked(service.rejectReviewerPropertyProposal);
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function detail(state: ReviewerPropertyProposalDetail['state']): ReviewerPropertyProposalDetail {
  return {
    id: 'proposal-1', state, version: 4, title: state === 'APROBADA' ? 'Casa aprobada' : 'Casa revisable', currentReviewRoundId: 'round-current',
    latestSubmittedAt: '2026-09-10T12:00:00.000Z', createdAt: '2026-09-01', updatedAt: '2026-09-10',
    addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', operationType: 'SALE',
    totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null,
    ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null,
    proposedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
    history: [{ id: 'round-current', roundNumber: 2, submittedAt: '2026-09-10T12:00:00.000Z',
      submittedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
      snapshot: { title: 'Casa revisable' } as ReviewerPropertyProposalDetail['history'][number]['snapshot'], decision: null }]
  };
}
describe('reviewer decision cache', () => {
  it('shows the authoritative state and retains safe conflict copy after a populated detail refetch', async () => {
    getDetail.mockResolvedValueOnce(detail('EN_REVISION')).mockResolvedValueOnce(detail('APROBADA'));
    reject.mockRejectedValueOnce(new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    render(<PropertyProposalReviewDetail tenantId='tenant-1' proposalId='proposal-1' enabled />, { wrapper });
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('EN REVISIÓN');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rechazar propuesta' }));
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Motivo del rechazo' }), 'Falta documentación');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('APROBADA');
    expect(screen.getByRole('heading', { name: 'Casa aprobada' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rechazar propuesta' })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('La propuesta cambió. Actualizá e intentá nuevamente.');
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
    expect(client.getQueryData(['property-proposals', 'tenant-1', 'reviewer', 'detail', 'proposal-1']))
      .toMatchObject({ state: 'APROBADA', title: 'Casa aprobada' });
  });
});

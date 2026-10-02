import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import * as service from '../api/service';
import type { ReviewerPropertyProposalDetail } from '../api/types';
import { PropertyProposalReviewDetail } from './property-proposal-review-detail';
vi.mock('../api/service', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/service')>(),
  getReviewerPropertyProposal: vi.fn(),
  approveReviewerPropertyProposal: vi.fn(),
  rejectReviewerPropertyProposal: vi.fn()
}));
const getDetail = vi.mocked(service.getReviewerPropertyProposal);
const approve = vi.mocked(service.approveReviewerPropertyProposal);
const reject = vi.mocked(service.rejectReviewerPropertyProposal);
function detail(overrides: Partial<ReviewerPropertyProposalDetail> = {}): ReviewerPropertyProposalDetail {
  return {
    id: 'proposal-1', state: 'EN_REVISION', version: 4, title: 'Casa revisable',
    currentReviewRoundId: 'round-current', canonicalEngagementId: undefined,
    latestSubmittedAt: '2026-09-10T12:00:00.000Z', createdAt: '2026-09-01', updatedAt: '2026-09-10',
    addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE',
    operationType: 'SALE', totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null,
    bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null,
    ownerEmail: null, publishedPriceCents: null, currency: null,
    proposedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
    history: [{ id: 'round-current', roundNumber: 2, submittedAt: '2026-09-10T12:00:00.000Z',
      submittedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
      snapshot: { title: 'Casa revisable' } as ReviewerPropertyProposalDetail['history'][number]['snapshot'], decision: null }],
    ...overrides
  };
}
function renderDetail(strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const component = <PropertyProposalReviewDetail tenantId='tenant-1' proposalId='proposal-1' enabled />;
  return { client, ...render(strict ? <StrictMode>{component}</StrictMode> : component, { wrapper }) };
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { getDetail.mockResolvedValue(detail()); });
describe('PropertyProposalReviewDetail', () => {
  it('keeps its reviewer query cached after unmount', async () => {
    const { client, unmount } = renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.getQueryCache().findAll({ queryKey: ['property-proposals', 'tenant-1'] })).toHaveLength(1);
  });

  it('loads delayed data under StrictMode without leaving the pending loader', async () => {
    getDetail.mockImplementation((_id, init) => new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('The operation was aborted', 'AbortError'));
      if (init?.signal?.aborted) return abort();
      init?.signal?.addEventListener('abort', abort, { once: true });
      setTimeout(() => {
        init?.signal?.removeEventListener('abort', abort);
        resolve(detail());
      }, 35);
    }));
    renderDetail(true);
    expect(await screen.findByRole('heading', { name: 'Casa revisable' }, { timeout: 500 })).toBeVisible();
    expect(screen.queryByText('Cargando propuesta…')).toBeNull();
  });
  it('loads scoped detail, keeps non-reviewable states read-only, and renders coded self-review errors', async () => {
    getDetail.mockResolvedValueOnce(detail({ state: 'APROBADA' }));
    const { unmount } = renderDetail();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Casa revisable' })).toBeVisible());
    expect(getDetail).toHaveBeenCalledWith('proposal-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).toBeNull();
    unmount();
    approve.mockRejectedValueOnce(new BffError(403, 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN'));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Aprobar propuesta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No podés revisar tu propia propuesta.');
  });
  it('keeps an EN_REVISION record without a current round read-only and hides absent result links', async () => {
    getDetail.mockResolvedValueOnce(detail({ currentReviewRoundId: undefined }));
    const { unmount } = renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).toBeNull();
    unmount();
    getDetail.mockResolvedValueOnce(detail({ state: 'APROBADA', canonicalEngagementId: undefined }));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ver propiedad aprobada' })).toBeNull();
  });
  it('submits the exact current round and does not show approval before authoritative success', async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReviewerPropertyProposalDetail) => void;
    approve.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Aprobar propuesta' }));
    expect(approve).toHaveBeenCalledWith('proposal-1', { reviewRoundId: 'round-current' });
    expect(screen.getByRole('button', { name: 'Aprobar propuesta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar propuesta' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('EN REVISIÓN');
    const approved = detail({ state: 'APROBADA', canonicalEngagementId: 'engagement-authorized' });
    getDetail.mockResolvedValueOnce(approved);
    resolve(approved);
    expect(await screen.findByRole('link', { name: 'Ver propiedad aprobada' })).toHaveAttribute(
      'href', '/dashboard/product/engagement-authorized'
    );
  });
  it('trims a bounded rejection reason, locks actions while pending, and displays coded conflict copy', async () => {
    const user = userEvent.setup();
    let rejectNow!: () => void;
    reject.mockReturnValueOnce(new Promise((_, fail) => { rejectNow = () => fail(new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')); }));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Casa revisable' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Rechazar propuesta' }));
    const reason = screen.getByRole('textbox', { name: 'Motivo del rechazo' });
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    await user.type(reason, '   ');
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    await user.clear(reason);
    await user.type(reason, '  Falta documentación  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(reject).toHaveBeenCalledWith('proposal-1', { reviewRoundId: 'round-current', reason: 'Falta documentación' });
    expect(screen.getByRole('button', { name: 'Aprobar propuesta' })).toBeDisabled();
    rejectNow();
    expect(await screen.findByRole('alert')).toHaveTextContent('La propuesta cambió. Actualizá e intentá nuevamente.');
    // Hostile TypeError fallback is covered by api/service.test.ts, not this UI test.
  });
});

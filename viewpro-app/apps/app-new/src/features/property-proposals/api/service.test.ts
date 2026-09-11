import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import * as client from '@/lib/bff-client';
import type { ReviewerPropertyProposalDetail, ReviewerPropertyProposalSummary, SellerPropertyProposalDetail, SellerPropertyProposalSummary } from './types';
import {
  approveReviewerPropertyProposal,
  createSellerPropertyProposal,
  getReviewerPropertyProposal,
  getSellerPropertyProposal,
  listReviewerPropertyProposals,
  listSellerPropertyProposals,
  propertyProposalErrorCopy,
  rejectReviewerPropertyProposal,
  submitSellerPropertyProposal,
  updateSellerPropertyProposal
} from './service';

vi.mock('@/lib/bff-client', async (original) => ({
  ...(await original<typeof import('@/lib/bff-client')>()),
  bffRequest: vi.fn()
}));

const bffRequest = vi.mocked(client.bffRequest);

afterEach(() => vi.clearAllMocks());

const id = 'sale/id';
const roundId = 'round/id';
const sellerWire = {
  id: 'seller-proposal', state: 'BORRADOR', version: 1, title: 'Casa', latestSubmittedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z'
} satisfies SellerPropertyProposalSummary;
const reviewerWire = {
  ...sellerWire, proposedBy: { id: 'seller', firstName: 'Ada', lastName: null }
} satisfies ReviewerPropertyProposalSummary;
const json = (body: unknown, method: 'PATCH' | 'POST') => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method
});

describe('property proposal service', () => {
  it.each([
    ['create', () => createSellerPropertyProposal({ title: 'Casa' }), '/api/property-proposals', json({ title: 'Casa' }, 'POST')],
    ['seller list', () => listSellerPropertyProposals({ page: 2, pageSize: 10 }), '/api/property-proposals?page=2&pageSize=10', {}],
    ['seller detail', () => getSellerPropertyProposal(id), '/api/property-proposals/sale%2Fid', {}],
    ['update', () => updateSellerPropertyProposal(id, { expectedVersion: 2, title: 'Casa' }), '/api/property-proposals/sale%2Fid', json({ expectedVersion: 2, title: 'Casa' }, 'PATCH')],
    ['submit', () => submitSellerPropertyProposal(id, { expectedVersion: 2 }), '/api/property-proposals/sale%2Fid/submit', json({ expectedVersion: 2 }, 'POST')],
    ['review list', () => listReviewerPropertyProposals({ state: 'EN_REVISION', history: 'PENDING', page: 1, pageSize: 20 }), '/api/property-proposals/review?state=EN_REVISION&history=PENDING&page=1&pageSize=20', {}],
    ['review detail', () => getReviewerPropertyProposal(id), '/api/property-proposals/review/sale%2Fid', {}],
    ['reject', () => rejectReviewerPropertyProposal(id, { reviewRoundId: roundId, reason: 'Falta dirección' }), '/api/property-proposals/review/sale%2Fid/reject', json({ reviewRoundId: roundId, reason: 'Falta dirección' }, 'POST')],
    ['approve', () => approveReviewerPropertyProposal(id, { reviewRoundId: roundId }), '/api/property-proposals/review/sale%2Fid/approve', json({ reviewRoundId: roundId }, 'POST')]
  ])('uses the exact %s BFF contract', async (_name, call, path, init) => {
    bffRequest.mockResolvedValueOnce({} as never);
    await call();
    expect(bffRequest).toHaveBeenLastCalledWith(path, init, { timeoutMs: 10_000 });
  });

  it('omits undefined list filters from the BFF path', async () => {
    bffRequest.mockResolvedValueOnce({} as never);
    await listReviewerPropertyProposals({ state: undefined, history: undefined, page: undefined, pageSize: undefined });
    expect(bffRequest).toHaveBeenLastCalledWith('/api/property-proposals/review', {}, { timeoutMs: 10_000 });
  });

  it('forwards only a caller signal and keeps mutation init authoritative', async () => {
    bffRequest.mockResolvedValueOnce({} as never);
    const controller = new AbortController();
    await createSellerPropertyProposal({ title: 'Casa' }, {
      body: 'hostile body', cache: 'force-cache', headers: { authorization: 'hostile' }, method: 'DELETE', signal: controller.signal
    });
    expect(bffRequest).toHaveBeenLastCalledWith('/api/property-proposals', {
      ...json({ title: 'Casa' }, 'POST'), signal: controller.signal
    }, { timeoutMs: 10_000 });
  });

  it('keeps seller and reviewer wire contracts distinct at compile time', () => {
    expectTypeOf(sellerWire).toMatchTypeOf<SellerPropertyProposalSummary>();
    expectTypeOf(reviewerWire).toMatchTypeOf<ReviewerPropertyProposalSummary>();
    expectTypeOf<Awaited<ReturnType<typeof getSellerPropertyProposal>>>().toEqualTypeOf<SellerPropertyProposalDetail>();
    expectTypeOf<Awaited<ReturnType<typeof getReviewerPropertyProposal>>>().toEqualTypeOf<ReviewerPropertyProposalDetail>();
  });

  it.each([
    ['PROPERTY_PROPOSAL_NOT_FOUND', 'No encontramos la propuesta.'],
    ['PROPERTY_PROPOSAL_STATE_CONFLICT', 'La propuesta cambió. Actualizá e intentá nuevamente.'],
    ['PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN', 'No podés revisar tu propia propuesta.'],
    ['PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE', 'Completá los campos requeridos antes de enviar.'],
    ['PROPERTY_PROPOSAL_REJECTION_REASON_INVALID', 'Ingresá un motivo de rechazo válido.'],
    ['PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE', 'La persona vendedora ya no cumple los requisitos.'],
    ['TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED', 'Se alcanzó el límite de propiedades activas.']
  ])('maps only known %s locally', (code, copy) => {
    expect(propertyProposalErrorCopy(new BffError(409, code as never), 'Fallback')).toBe(copy);
  });

  it('uses caller fallback for unknown, network, and request-ID-bearing errors', () => {
    expect(propertyProposalErrorCopy(new BffError(500, undefined, '12345678-1234-4abc-8def-123456789abc'), 'Fallback')).toBe('Fallback');
    expect(propertyProposalErrorCopy(new TypeError('hostile backend prose'), 'Fallback')).toBe('Fallback');
  });
});

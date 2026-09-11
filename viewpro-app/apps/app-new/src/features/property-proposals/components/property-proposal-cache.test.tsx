import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import * as service from '../api/service';
import {
  propertyProposalKeys,
  useSubmitSellerPropertyProposal,
  useUpdateSellerPropertyProposal
} from '../api/queries';
import type { SellerPropertyProposalDetail } from '../api/types';
import { PropertyProposalDetail } from './property-proposal-detail';

vi.mock('../api/service', () => ({
  getSellerPropertyProposal: vi.fn(),
  submitSellerPropertyProposal: vi.fn(),
  updateSellerPropertyProposal: vi.fn()
}));

const getSellerPropertyProposal = vi.mocked(service.getSellerPropertyProposal);
const submitSellerPropertyProposal = vi.mocked(service.submitSellerPropertyProposal);
const updateSellerPropertyProposal = vi.mocked(service.updateSellerPropertyProposal);
const tenantA = 'tenant-a';
const tenantB = 'tenant-b';
const proposalId = 'proposal-1';

function proposal(title: string): SellerPropertyProposalDetail {
  return {
    id: proposalId,
    state: 'BORRADOR',
    version: 2,
    title,
    addressLine: null,
    city: null,
    province: null,
    propertyType: null,
    operationType: null,
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
    currency: null,
    history: [],
    currentReviewRoundId: undefined,
    canonicalEngagementId: undefined,
    latestSubmittedAt: null,
    createdAt: '',
    updatedAt: ''
  };
}

type Mutation = { mutateAsync: (payload: unknown) => Promise<unknown> };
type RequestMock = { mockResolvedValueOnce: (value: SellerPropertyProposalDetail) => unknown };

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

async function expectSellerInvalidation(
  hook: () => Mutation,
  payload: unknown,
  request: RequestMock
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  request.mockResolvedValueOnce(proposal('Actualizada'));
  const { result } = renderHook(hook, { wrapper: wrapper(client) });

  await result.current.mutateAsync(payload);

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: propertyProposalKeys.all(tenantA, 'seller')
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: propertyProposalKeys.all(tenantA, 'reviewer')
  });
}

afterEach(() => vi.clearAllMocks());

describe('seller property proposal detail cache', () => {
  it('resets editable fields for a new tenant while disposing both old-tenant audiences', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const sellerList = propertyProposalKeys.list(tenantA, 'seller', { page: 1, pageSize: 20 });
    const sellerDetail = propertyProposalKeys.detail(tenantA, 'seller', proposalId);
    const reviewerList = propertyProposalKeys.list(tenantA, 'reviewer', {
      page: 1,
      pageSize: 20,
      state: 'EN_REVISION'
    });
    const reviewerDetail = propertyProposalKeys.detail(tenantA, 'reviewer', proposalId);
    const newSellerDetail = propertyProposalKeys.detail(tenantB, 'seller', proposalId);
    client.setQueryData(sellerList, { items: ['seller-a'] });
    client.setQueryData(sellerDetail, proposal('Tenant A'));
    client.setQueryData(reviewerList, { items: ['reviewer-a'] });
    client.setQueryData(reviewerDetail, proposal('Reviewer A'));
    client.setQueryData(newSellerDetail, proposal('Tenant B'));
    getSellerPropertyProposal
      .mockResolvedValueOnce(proposal('Tenant A'))
      .mockResolvedValueOnce(proposal('Tenant B'));

    const view = render(
      <PropertyProposalDetail tenantId={tenantA} proposalId={proposalId} enabled />,
      { wrapper: wrapper(client) }
    );
    await screen.findByText('Tenant A');
    await user.clear(screen.getByLabelText('Título'));
    await user.type(screen.getByLabelText('Título'), 'Cambio tenant A');
    view.rerender(<PropertyProposalDetail tenantId={tenantB} proposalId={proposalId} enabled />);

    await screen.findByText('Tenant B');
    expect(screen.getByLabelText('Título')).toHaveValue('Tenant B');
    expect(client.getQueryData(newSellerDetail)).toEqual(
      expect.objectContaining({ title: 'Tenant B' })
    );
    await waitFor(() => {
      expect(client.getQueryData(sellerList)).toBeUndefined();
      expect(client.getQueryData(sellerDetail)).toBeUndefined();
      expect(client.getQueryData(reviewerList)).toBeUndefined();
      expect(client.getQueryData(reviewerDetail)).toBeUndefined();
    });
  });

  it('does not display another proposal conflict after this detail refetches', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const detail = propertyProposalKeys.detail(tenantA, 'seller', proposalId);
    client.setQueryData(detail, proposal('This proposal'));
    getSellerPropertyProposal.mockResolvedValue({ ...proposal('Refetched proposal'), version: 3 });
    render(<PropertyProposalDetail tenantId={tenantA} proposalId={proposalId} enabled />, {
      wrapper: wrapper(client)
    });
    await screen.findByText('This proposal');

    updateSellerPropertyProposal.mockRejectedValueOnce(
      new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
    );
    const mutation = renderHook(() => useUpdateSellerPropertyProposal(tenantA, 'proposal-2'), {
      wrapper: wrapper(client)
    });
    await expect(
      mutation.result.current.mutateAsync({ expectedVersion: 2, title: 'Other proposal' })
    ).rejects.toMatchObject({ status: 409 });
    await client.invalidateQueries({ queryKey: detail });

    await screen.findByText('Refetched proposal');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('invalidates both audiences after a successful seller update', async () => {
    await expectSellerInvalidation(
      () => useUpdateSellerPropertyProposal(tenantA, proposalId) as unknown as Mutation,
      { expectedVersion: 2, title: 'Casa' },
      updateSellerPropertyProposal
    );
  });

  it('invalidates both audiences after a successful seller submit', async () => {
    await expectSellerInvalidation(
      () => useSubmitSellerPropertyProposal(tenantA, proposalId) as unknown as Mutation,
      { expectedVersion: 2 },
      submitSellerPropertyProposal
    );
  });
});

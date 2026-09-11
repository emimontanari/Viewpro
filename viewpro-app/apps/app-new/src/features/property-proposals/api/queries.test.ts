import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as service from './service';
import {
  cancelAndRemovePropertyProposalQueries,
  propertyProposalKeys,
  reviewerPropertyProposalDetailOptions,
  reviewerPropertyProposalsOptions,
  sellerPropertyProposalDetailOptions,
  sellerPropertyProposalsOptions
} from './queries';

vi.mock('./service', () => ({
  getReviewerPropertyProposal: vi.fn(),
  getSellerPropertyProposal: vi.fn(),
  listReviewerPropertyProposals: vi.fn(),
  listSellerPropertyProposals: vi.fn()
}));

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';
const proposalId = 'proposal-a';
const mockedService = vi.mocked(service);
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => vi.clearAllMocks());

describe('property proposal read keys', () => {
  it('isolates every hierarchy key by required tenant and audience', () => {
    expect(propertyProposalKeys.all(tenantA, 'seller')).toEqual(['property-proposals', tenantA, 'seller']);
    expect(propertyProposalKeys.lists(tenantA, 'reviewer')).toEqual(['property-proposals', tenantA, 'reviewer', 'list']);
    expect(propertyProposalKeys.list(tenantA, 'seller', { page: 1, pageSize: 20 })).toEqual([
      'property-proposals', tenantA, 'seller', 'list', { page: 1, pageSize: 20 }
    ]);
    expect(propertyProposalKeys.detail(tenantA, 'reviewer', proposalId)).toEqual([
      'property-proposals', tenantA, 'reviewer', 'detail', proposalId
    ]);
    expect(propertyProposalKeys.all(tenantA, 'seller')).not.toEqual(propertyProposalKeys.all(tenantB, 'seller'));
    expect(propertyProposalKeys.all(tenantA, 'seller')).not.toEqual(propertyProposalKeys.all(tenantA, 'reviewer'));
  });

  it('makes omitted and explicit undefined seller/reviewer filters use the same default key', () => {
    expect(sellerPropertyProposalsOptions(tenantA).queryKey).toEqual(
      sellerPropertyProposalsOptions(tenantA, { page: undefined, pageSize: undefined }).queryKey
    );
    expect(reviewerPropertyProposalsOptions(tenantA).queryKey).toEqual(
      reviewerPropertyProposalsOptions(tenantA, {
        state: undefined, history: undefined, page: undefined, pageSize: undefined
      }).queryKey
    );
  });

  it('uses the normalized filters for both list keys and exact service calls, while forwarding every signal', async () => {
    const signal = new AbortController().signal;
    const options = [
      sellerPropertyProposalsOptions(tenantA, {}),
      sellerPropertyProposalDetailOptions(tenantA, proposalId),
      reviewerPropertyProposalsOptions(tenantA, { history: 'PENDING' }),
      reviewerPropertyProposalDetailOptions(tenantA, proposalId)
    ];

    for (const option of options) await option.queryFn!({ signal } as never);

    expect(options[0].queryKey).toEqual(propertyProposalKeys.list(tenantA, 'seller', { page: 1, pageSize: 20 }));
    expect(options[2].queryKey).toEqual(propertyProposalKeys.list(tenantA, 'reviewer', {
      history: 'PENDING', page: 1, pageSize: 20, state: 'EN_REVISION'
    }));
    expect(mockedService.listSellerPropertyProposals).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, { signal });
    expect(mockedService.getSellerPropertyProposal).toHaveBeenCalledWith(proposalId, { signal });
    expect(mockedService.listReviewerPropertyProposals).toHaveBeenCalledWith(
      { history: 'PENDING', page: 1, pageSize: 20, state: 'EN_REVISION' }, { signal }
    );
    expect(mockedService.getReviewerPropertyProposal).toHaveBeenCalledWith(proposalId, { signal });
  });
});

describe('old tenant query cleanup', () => {
  it('aborts actual pending seller and reviewer reads, then keeps the new tenant cache', async () => {
    const queryClient = client();
    const aborted: string[] = [];
    const pending = (audience: string, signal?: AbortSignal | null) => new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => { aborted.push(audience); reject(signal.reason); }, { once: true });
    });
    mockedService.listSellerPropertyProposals.mockImplementation((_filters, init) => pending('seller', init?.signal));
    mockedService.listReviewerPropertyProposals.mockImplementation((_filters, init) => pending('reviewer', init?.signal));
    const sellerFetch = queryClient.fetchQuery(sellerPropertyProposalsOptions(tenantA));
    const reviewerFetch = queryClient.fetchQuery(reviewerPropertyProposalsOptions(tenantA));
    sellerFetch.catch(() => undefined);
    reviewerFetch.catch(() => undefined);
    await vi.waitFor(() => expect(mockedService.listReviewerPropertyProposals).toHaveBeenCalledOnce());
    const newKey = propertyProposalKeys.list(tenantB, 'seller', { page: 1, pageSize: 20 });
    queryClient.setQueryData(newKey, { items: ['new'] });

    await cancelAndRemovePropertyProposalQueries(queryClient, tenantA);

    expect(aborted).toEqual(['seller', 'reviewer']);
    expect(queryClient.getQueryData(newKey)).toEqual({ items: ['new'] });
  });

  it('does not remove either audience until both cancellation promises settle in call order', async () => {
    const queryClient = client();
    let releaseSeller!: () => void;
    let releaseReviewer!: () => void;
    const sellerCancelled = new Promise<void>((resolve) => { releaseSeller = resolve; });
    const reviewerCancelled = new Promise<void>((resolve) => { releaseReviewer = resolve; });
    const cancel = vi.spyOn(queryClient, 'cancelQueries')
      .mockReturnValueOnce(sellerCancelled)
      .mockReturnValueOnce(reviewerCancelled);
    const remove = vi.spyOn(queryClient, 'removeQueries');

    const cleanup = cancelAndRemovePropertyProposalQueries(queryClient, tenantA);
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
    releaseSeller();
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
    releaseReviewer();
    await cleanup;

    expect(cancel).toHaveBeenNthCalledWith(1, { queryKey: propertyProposalKeys.all(tenantA, 'seller') });
    expect(cancel).toHaveBeenNthCalledWith(2, { queryKey: propertyProposalKeys.all(tenantA, 'reviewer') });
    expect(remove).toHaveBeenNthCalledWith(1, { queryKey: propertyProposalKeys.all(tenantA, 'seller') });
    expect(remove).toHaveBeenNthCalledWith(2, { queryKey: propertyProposalKeys.all(tenantA, 'reviewer') });
    expect(cancel.mock.invocationCallOrder[1]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });
});

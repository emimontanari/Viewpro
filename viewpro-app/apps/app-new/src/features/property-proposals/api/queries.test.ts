import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import { productKeys } from '@/features/products/api/queries';
import * as service from './service';
import {
  cancelAndRemovePropertyProposalQueries,
  propertyProposalKeys,
  reviewerPropertyProposalDetailOptions,
  reviewerPropertyProposalsOptions,
  sellerPropertyProposalDetailOptions,
  sellerPropertyProposalsOptions,
  useApproveReviewerPropertyProposal,
  useCreateSellerPropertyProposal,
  useRejectReviewerPropertyProposal,
  useSubmitSellerPropertyProposal,
  useUpdateSellerPropertyProposal
} from './queries';

vi.mock('./service', () => ({
  getReviewerPropertyProposal: vi.fn(),
  getSellerPropertyProposal: vi.fn(),
  listReviewerPropertyProposals: vi.fn(),
  listSellerPropertyProposals: vi.fn(),
  approveReviewerPropertyProposal: vi.fn(),
  createSellerPropertyProposal: vi.fn(),
  rejectReviewerPropertyProposal: vi.fn(),
  submitSellerPropertyProposal: vi.fn(),
  updateSellerPropertyProposal: vi.fn()
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

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('property proposal mutations', () => {
  const roundId = 'round-a';
  const mutations = [
    ['create', () => useCreateSellerPropertyProposal(tenantA), { title: 'Casa' }, () =>
      expect(mockedService.createSellerPropertyProposal).toHaveBeenCalledWith({ title: 'Casa' })],
    ['update', () => useUpdateSellerPropertyProposal(tenantA, proposalId), { expectedVersion: 2, title: 'Casa' }, () =>
      expect(mockedService.updateSellerPropertyProposal).toHaveBeenCalledWith(proposalId, { expectedVersion: 2, title: 'Casa' })],
    ['submit', () => useSubmitSellerPropertyProposal(tenantA, proposalId), { expectedVersion: 2 }, () =>
      expect(mockedService.submitSellerPropertyProposal).toHaveBeenCalledWith(proposalId, { expectedVersion: 2 })],
    ['reject', () => useRejectReviewerPropertyProposal(tenantA, proposalId), { reviewRoundId: roundId, reason: 'Falta dirección' }, () =>
      expect(mockedService.rejectReviewerPropertyProposal).toHaveBeenCalledWith(proposalId, { reviewRoundId: roundId, reason: 'Falta dirección' })],
    ['approve', () => useApproveReviewerPropertyProposal(tenantA, proposalId), { reviewRoundId: roundId }, () =>
      expect(mockedService.approveReviewerPropertyProposal).toHaveBeenCalledWith(proposalId, { reviewRoundId: roundId })]
  ] as const;

  it.each(mutations)('%s captures tenant/proposal identifiers and invalidates only its required cache families', async (name, hook, payload, called) => {
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(hook as () => unknown, { wrapper: wrapper(queryClient) });

    await (result.current as { mutateAsync: (variables: unknown) => Promise<unknown> }).mutateAsync(payload);

    called();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: propertyProposalKeys.all(tenantA, 'seller') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: propertyProposalKeys.all(tenantA, 'reviewer') });
    if (name === 'approve') expect(invalidate).toHaveBeenCalledWith({ queryKey: productKeys.all });
    else expect(invalidate).not.toHaveBeenCalledWith({ queryKey: productKeys.all });
  });

  it('refetches active seller/reviewer observers only for a real 409 and never fabricates their cache', async () => {
    const queryClient = client();
    const seller = { items: ['seller'], page: 1, pageSize: 20, total: 1 };
    const reviewer = { id: proposalId, state: 'EN_REVISION' };
    mockedService.listSellerPropertyProposals.mockResolvedValue(seller as never);
    mockedService.getReviewerPropertyProposal.mockResolvedValue(reviewer as never);
    const sellerObserver = new QueryObserver(queryClient, sellerPropertyProposalsOptions(tenantA));
    const reviewerObserver = new QueryObserver(queryClient, reviewerPropertyProposalDetailOptions(tenantA, proposalId));
    const stopSeller = sellerObserver.subscribe(() => undefined);
    const stopReviewer = reviewerObserver.subscribe(() => undefined);
    await waitFor(() => expect(mockedService.getReviewerPropertyProposal).toHaveBeenCalledOnce());
    const sellerKey = sellerPropertyProposalsOptions(tenantA).queryKey;
    const reviewerKey = reviewerPropertyProposalDetailOptions(tenantA, proposalId).queryKey;
    mockedService.rejectReviewerPropertyProposal.mockRejectedValueOnce(
      new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
    );
    const { result } = renderHook(() => useRejectReviewerPropertyProposal(tenantA, proposalId), {
      wrapper: wrapper(queryClient)
    });

    await expect(result.current.mutateAsync({ reviewRoundId: roundId, reason: 'Falta dirección' })).rejects.toMatchObject({ status: 409 });
    await waitFor(() => {
      expect(mockedService.listSellerPropertyProposals).toHaveBeenCalledTimes(2);
      expect(mockedService.getReviewerPropertyProposal).toHaveBeenCalledTimes(2);
    });
    expect(queryClient.getQueryData(sellerKey)).toBe(seller);
    expect(queryClient.getQueryData(reviewerKey)).toBe(reviewer);

    mockedService.rejectReviewerPropertyProposal.mockRejectedValueOnce(new BffError(500));
    await expect(result.current.mutateAsync({ reviewRoundId: roundId, reason: 'Falta dirección' })).rejects.toMatchObject({ status: 500 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedService.listSellerPropertyProposals).toHaveBeenCalledTimes(2);
    expect(mockedService.getReviewerPropertyProposal).toHaveBeenCalledTimes(2);
    mockedService.rejectReviewerPropertyProposal.mockRejectedValueOnce({ status: 409 });
    await expect(result.current.mutateAsync({ reviewRoundId: roundId, reason: 'Falta dirección' })).rejects.toEqual({ status: 409 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedService.listSellerPropertyProposals).toHaveBeenCalledTimes(2);
    expect(mockedService.getReviewerPropertyProposal).toHaveBeenCalledTimes(2);
    stopSeller();
    stopReviewer();
  });

  it('leaves the reviewer cache byte-equivalent while a decision is pending', async () => {
    const queryClient = client();
    const key = propertyProposalKeys.detail(tenantA, 'reviewer', proposalId);
    const cached = { id: proposalId, state: 'EN_REVISION' };
    queryClient.setQueryData(key, cached);
    let reject!: (error: Error) => void;
    mockedService.approveReviewerPropertyProposal.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const { result } = renderHook(() => useApproveReviewerPropertyProposal(tenantA, proposalId), {
      wrapper: wrapper(queryClient)
    });

    const pending = result.current.mutateAsync({ reviewRoundId: roundId });
    await waitFor(() => expect(mockedService.approveReviewerPropertyProposal).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(key)).toBe(cached);
    reject(new BffError(500));
    await expect(pending).rejects.toMatchObject({ status: 500 });
  });
});

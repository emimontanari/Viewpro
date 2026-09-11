import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  getReviewerPropertyProposal,
  getSellerPropertyProposal,
  listReviewerPropertyProposals,
  listSellerPropertyProposals
} from './service';
import type { ReviewerPropertyProposalFilters, SellerPropertyProposalFilters } from './types';

export type PropertyProposalAudience = 'seller' | 'reviewer';

const audiences: readonly PropertyProposalAudience[] = ['seller', 'reviewer'];

export const propertyProposalKeys = {
  all: (tenantId: string, audience: PropertyProposalAudience) =>
    ['property-proposals', tenantId, audience] as const,
  lists: (tenantId: string, audience: PropertyProposalAudience) =>
    [...propertyProposalKeys.all(tenantId, audience), 'list'] as const,
  list: (tenantId: string, audience: PropertyProposalAudience, filters: object) =>
    [...propertyProposalKeys.lists(tenantId, audience), filters] as const,
  detail: (tenantId: string, audience: PropertyProposalAudience, proposalId: string) =>
    [...propertyProposalKeys.all(tenantId, audience), 'detail', proposalId] as const
};

export function sellerPropertyProposalsOptions(tenantId: string, filters: SellerPropertyProposalFilters = {}) {
  const normalizedFilters = normalizeSellerFilters(filters);
  return queryOptions({
    queryKey: propertyProposalKeys.list(tenantId, 'seller', normalizedFilters),
    queryFn: ({ signal }) => listSellerPropertyProposals(normalizedFilters, { signal })
  });
}

export function sellerPropertyProposalDetailOptions(tenantId: string, proposalId: string) {
  return queryOptions({
    queryKey: propertyProposalKeys.detail(tenantId, 'seller', proposalId),
    queryFn: ({ signal }) => getSellerPropertyProposal(proposalId, { signal })
  });
}

export function reviewerPropertyProposalsOptions(tenantId: string, filters: ReviewerPropertyProposalFilters = {}) {
  const normalizedFilters = normalizeReviewerFilters(filters);
  return queryOptions({
    queryKey: propertyProposalKeys.list(tenantId, 'reviewer', normalizedFilters),
    queryFn: ({ signal }) => listReviewerPropertyProposals(normalizedFilters, { signal })
  });
}

export function reviewerPropertyProposalDetailOptions(tenantId: string, proposalId: string) {
  return queryOptions({
    queryKey: propertyProposalKeys.detail(tenantId, 'reviewer', proposalId),
    queryFn: ({ signal }) => getReviewerPropertyProposal(proposalId, { signal })
  });
}

export async function cancelAndRemovePropertyProposalQueries(queryClient: QueryClient, tenantId: string) {
  const keys = audiences.map((audience) => propertyProposalKeys.all(tenantId, audience));
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
  for (const queryKey of keys) queryClient.removeQueries({ queryKey });
}

function normalizeSellerFilters(filters: SellerPropertyProposalFilters) {
  return { page: filters.page ?? 1, pageSize: filters.pageSize ?? 20 };
}

function normalizeReviewerFilters(filters: ReviewerPropertyProposalFilters) {
  return {
    ...(filters.history ? { history: filters.history } : {}),
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
    state: filters.state ?? 'EN_REVISION'
  };
}

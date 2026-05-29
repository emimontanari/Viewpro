import { getDocumentRequestsRefetchInterval } from '@/lib/document-request-refresh';
import { queryOptions } from '@tanstack/react-query';
import {
  getAssignableProductAgents,
  getProductDocumentRequests,
  getProducts,
  getProductById
} from './service';
import type { Product, ProductFilters } from './types';

export type { Product };

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => [...productKeys.all, 'list', filters] as const,
  detail: (id: string, tenantId?: string | null) =>
    [...productKeys.all, 'detail', id, tenantId ?? 'no-tenant'] as const,
  movements: (id: string, tenantId?: string | null) =>
    [...productKeys.all, 'movements', id, tenantId ?? 'no-tenant'] as const,
  documentRequests: (id: string, tenantId?: string | null) =>
    [...productKeys.all, 'document-requests', id, tenantId ?? 'no-tenant'] as const,
  assignableAgents: (tenantId?: string | null) =>
    [...productKeys.all, 'assignable-agents', tenantId ?? 'no-tenant'] as const
};

export const productsQueryOptions = (filters: ProductFilters) =>
  queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: () => getProducts(filters)
  });

export const productByIdOptions = (id: string, tenantId?: string | null) =>
  queryOptions({
    queryKey: productKeys.detail(id, tenantId),
    queryFn: () => getProductById(id)
  });

export const productDocumentRequestsOptions = (id: string, tenantId?: string | null) =>
  queryOptions({
    queryKey: productKeys.documentRequests(id, tenantId),
    queryFn: () => getProductDocumentRequests(id, { pageSize: 10 }),
    refetchInterval: getDocumentRequestsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always'
  });

export const assignableProductAgentsOptions = (tenantId?: string | null) =>
  queryOptions({
    queryKey: productKeys.assignableAgents(tenantId),
    queryFn: getAssignableProductAgents
  });

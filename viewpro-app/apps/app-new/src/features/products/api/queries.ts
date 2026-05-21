import { queryOptions } from '@tanstack/react-query';
import { getProducts, getProductById } from './service';
import type { Product, ProductFilters } from './types';

export type { Product };

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => [...productKeys.all, 'list', filters] as const,
  detail: (id: string, tenantId?: string | null) =>
    [...productKeys.all, 'detail', id, tenantId ?? 'no-tenant'] as const
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

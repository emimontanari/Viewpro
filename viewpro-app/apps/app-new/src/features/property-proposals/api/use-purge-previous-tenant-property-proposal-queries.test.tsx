import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  propertyProposalKeys,
  usePurgePreviousTenantPropertyProposalQueries
} from './queries';

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function seedTenant(client: QueryClient, tenantId: string) {
  for (const audience of ['seller', 'reviewer'] as const) {
    client.setQueryData(propertyProposalKeys.detail(tenantId, audience, `${audience}-proposal`), {
      tenantId,
      audience
    });
  }
}

function wrapper(client: QueryClient, strict = false) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      strict ? createElement(StrictMode, null, children) : children
    );
}

describe('usePurgePreviousTenantPropertyProposalQueries', () => {
  it('keeps stable-tenant proposal queries under StrictMode', () => {
    const client = createClient();
    seedTenant(client, tenantA);
    const cancel = vi.spyOn(client, 'cancelQueries');
    const remove = vi.spyOn(client, 'removeQueries');

    const { unmount } = renderHook(
      () => usePurgePreviousTenantPropertyProposalQueries(tenantA),
      { wrapper: wrapper(client, true) }
    );

    expect(client.getQueryCache().findAll({ queryKey: ['property-proposals', tenantA] })).toHaveLength(2);
    expect(cancel).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    unmount();
  });

  it('purges both audiences for the previous tenant and keeps the current tenant cache', async () => {
    const client = createClient();
    seedTenant(client, tenantA);
    seedTenant(client, tenantB);
    const cancel = vi.spyOn(client, 'cancelQueries');
    const remove = vi.spyOn(client, 'removeQueries');
    const { rerender } = renderHook(
      ({ tenantId }) => usePurgePreviousTenantPropertyProposalQueries(tenantId),
      { initialProps: { tenantId: tenantA }, wrapper: wrapper(client) }
    );

    rerender({ tenantId: tenantB });
    await waitFor(() =>
      expect(client.getQueryCache().findAll({ queryKey: ['property-proposals', tenantA] })).toHaveLength(0)
    );

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(client.getQueryCache().findAll({ queryKey: ['property-proposals', tenantB] })).toHaveLength(2);
  });

  it('does not purge queries on unmount', async () => {
    const client = createClient();
    seedTenant(client, tenantA);
    const cancel = vi.spyOn(client, 'cancelQueries');
    const remove = vi.spyOn(client, 'removeQueries');
    const { unmount } = renderHook(
      () => usePurgePreviousTenantPropertyProposalQueries(tenantA),
      { wrapper: wrapper(client) }
    );

    unmount();
    await Promise.resolve();

    expect(client.getQueryCache().findAll({ queryKey: ['property-proposals', tenantA] })).toHaveLength(2);
    expect(cancel).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

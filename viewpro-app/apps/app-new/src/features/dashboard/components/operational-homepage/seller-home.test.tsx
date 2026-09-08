import { describe, expect, it, vi } from 'vitest';
import type { ActivityFeedResponse } from '@/features/activity/api/types';
import type { ProductsResponse } from '@/features/products/api/types';
import {
  toSellerActivityState,
  toSellerProductsState,
  type SellerActivityState,
  type SellerProductsState,
  type SellerQuerySnapshot
} from './seller-home';

const tenantId = 'tenant-a';
const products = {
  items: [{ id: 'engagement-a', tenantId }],
  total: 1
} as ProductsResponse;
const activity = {
  counters: { attentionCount: 1, staleCount: 2, todayCount: 3 },
  items: [
    {
      kind: 'movement',
      propertyEngagementId: 'engagement-a',
      property: { engagementId: 'engagement-a' },
      tenantId
    }
  ]
} as ActivityFeedResponse;

function snapshot<T>(overrides: Partial<SellerQuerySnapshot<T>> = {}): SellerQuerySnapshot<T> {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...overrides
  };
}

type SellerState = SellerProductsState | SellerActivityState;
type SellerAdapter<T> = (query: SellerQuerySnapshot<T>, tenantId: string) => SellerState;

function expectLifecycle<T>(adapter: SellerAdapter<T>, data: T, zero: T) {
  const retry = vi.fn();

  expect(adapter(snapshot<T>({ isLoading: true }), tenantId).status).toBe('loading');
  expect(adapter(snapshot({ data, isSuccess: true }), tenantId)).toMatchObject({
    data,
    status: 'ready'
  });
  expect(adapter(snapshot({ data: zero, isSuccess: true }), tenantId)).toMatchObject({
    data: zero,
    status: 'ready'
  });
  expect(adapter(snapshot({ data, isFetching: true, isSuccess: true }), tenantId)).toMatchObject({
    data,
    status: 'refreshing'
  });
  expect(adapter(snapshot({ data, isError: true, refetch: retry }), tenantId)).toMatchObject({
    data,
    retry,
    retrying: false,
    status: 'retained-error'
  });

  const error = adapter(snapshot<T>({ isError: true, isFetching: true, refetch: retry }), tenantId);
  expect(error).toMatchObject({ retry, retrying: true, status: 'error' });
  if (error.status === 'error') error.retry();
  expect(retry).toHaveBeenCalledTimes(1);
}

describe('seller query adapters', () => {
  it('keeps each source loading, successful zero, refresh, retained error, and local retry distinct', () => {
    expectLifecycle(toSellerProductsState, products, { ...products, items: [], total: 0 });
    expectLifecycle(toSellerActivityState, activity, {
      ...activity,
      counters: { attentionCount: 0, staleCount: 0, todayCount: 0 },
      items: []
    });
  });

  it('rejects malformed and cross-tenant product payloads instead of treating them as empty', () => {
    expect(
      toSellerProductsState(snapshot({ data: { ...products, total: -1 }, isSuccess: true }), tenantId)
    ).toMatchObject({ status: 'error', tenantId });
    expect(
      toSellerProductsState(
        snapshot({
          data: { ...products, items: [{ ...products.items[0], tenantId: 'tenant-b' }] },
          isSuccess: true
        }),
        tenantId
      )
    ).toMatchObject({ status: 'error', tenantId });
  });

  it('rejects null, missing, and malformed activity counters plus invalid item identities', () => {
    const invalidResponses = [
      { ...activity, counters: null },
      { items: activity.items },
      { ...activity, counters: { ...activity.counters, staleCount: Number.NaN } },
      { ...activity, items: [{ ...activity.items[0], tenantId: 'tenant-b' }] },
      { ...activity, items: [{ ...activity.items[0], propertyEngagementId: 'engagement-b' }] }
    ];

    for (const data of invalidResponses) {
      expect(
        toSellerActivityState(
          snapshot({ data: data as unknown as ActivityFeedResponse, isSuccess: true }),
          tenantId
        )
      ).toMatchObject({ status: 'error', tenantId });
    }
  });
});

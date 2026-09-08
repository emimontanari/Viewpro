import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activityFeedOptions } from '@/features/activity/api/queries';
import { getActivityFeed } from '@/features/activity/api/service';
import type { ActivityFeedResponse } from '@/features/activity/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import { getProducts } from '@/features/products/api/service';
import type { ProductsResponse } from '@/features/products/api/types';
import {
  SellerOperationalHomepage,
  toSellerActivityState,
  toSellerProductsState,
  type SellerActivityState,
  type SellerProductsState,
  type SellerQuerySnapshot
} from './seller-home';

vi.mock('@/features/activity/api/service', () => ({ getActivityFeed: vi.fn() }));
vi.mock('@/features/products/api/service', () => ({ getProducts: vi.fn() }));

const getActivityFeedMock = vi.mocked(getActivityFeed);
const getProductsMock = vi.mocked(getProducts);
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
  expect(adapter(snapshot({ data, isSuccess: true }), tenantId)).toMatchObject({ data, status: 'ready' });
  expect(adapter(snapshot({ data: zero, isSuccess: true }), tenantId)).toMatchObject({ data: zero, status: 'ready' });
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
    expect(toSellerProductsState(snapshot({ data: { ...products, total: -1 }, isSuccess: true }), tenantId)).toMatchObject({
      status: 'error',
      tenantId
    });
    expect(
      toSellerProductsState(
        snapshot({ data: { ...products, items: [{ ...products.items[0], tenantId: 'tenant-b' }] }, isSuccess: true }),
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
        toSellerActivityState(snapshot({ data: data as unknown as ActivityFeedResponse, isSuccess: true }), tenantId)
      ).toMatchObject({ status: 'error', tenantId });
    }
  });
});

describe('SellerOperationalHomepage production tenant transitions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps late tenant-A responses out of the keyed tenant-B production mount, then renders B-owned ready rows', async () => {
    const tenantAProducts = deferred<ProductsResponse>();
    const tenantAActivity = deferred<ActivityFeedResponse>();
    const tenantBProducts = deferred<ProductsResponse>();
    const tenantBActivity = deferred<ActivityFeedResponse>();
    getProductsMock.mockReturnValueOnce(tenantAProducts.promise).mockReturnValueOnce(tenantBProducts.promise);
    getActivityFeedMock.mockReturnValueOnce(tenantAActivity.promise).mockReturnValueOnce(tenantBActivity.promise);
    const queryClient = createQueryClient();
    const view = renderProductionSeller(queryClient, 'membership-a', 'tenant-a');

    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(1));
    view.rerender(productionSeller(queryClient, 'membership-b', 'tenant-b'));

    await waitFor(() => expect(getActivityFeedMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('products-state')).toHaveTextContent('loading:tenant-b:none');
    expect(screen.getByTestId('activity-state')).toHaveTextContent('loading:tenant-b:none');

    await act(async () => {
      tenantAProducts.resolve(productsFixture('tenant-a', 'A'));
      tenantAActivity.resolve(activityFixture('tenant-a', 'A'));
    });

    expect(screen.getByTestId('products-state')).toHaveTextContent('loading:tenant-b:none');
    expect(screen.getByTestId('activity-state')).toHaveTextContent('loading:tenant-b:none');
    expect(screen.queryByText('product-row:A')).not.toBeInTheDocument();
    expect(screen.queryByText('activity-row:A')).not.toBeInTheDocument();
    expect(screen.queryByText('product-value:101')).not.toBeInTheDocument();
    expect(screen.queryByText('activity-value:201')).not.toBeInTheDocument();

    await act(async () => {
      tenantBProducts.resolve(productsFixture('tenant-b', 'B'));
      tenantBActivity.resolve(activityFixture('tenant-b', 'B'));
    });

    await waitFor(() => expect(screen.getByTestId('products-state')).toHaveTextContent('ready:tenant-b:102'));
    expect(screen.getByTestId('activity-state')).toHaveTextContent('ready:tenant-b:202');
    expect(screen.getByText('product-row:B')).toBeVisible();
    expect(screen.getByText('activity-row:B')).toBeVisible();

    expectProductionOptions(queryClient, 'tenant-b');
  });

  it('keeps tenant B local to loading and error while late tenant-A responses resolve', async () => {
    const tenantAProducts = deferred<ProductsResponse>();
    const tenantAActivity = deferred<ActivityFeedResponse>();
    const tenantBProducts = deferred<ProductsResponse>();
    const tenantBActivity = deferred<ActivityFeedResponse>();
    getProductsMock.mockReturnValueOnce(tenantAProducts.promise).mockReturnValueOnce(tenantBProducts.promise);
    getActivityFeedMock.mockReturnValueOnce(tenantAActivity.promise).mockReturnValueOnce(tenantBActivity.promise);
    const queryClient = createQueryClient();
    const view = renderProductionSeller(queryClient, 'membership-a', 'tenant-a');

    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(1));
    view.rerender(productionSeller(queryClient, 'membership-b', 'tenant-b'));
    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('products-state')).toHaveTextContent('loading:tenant-b:none');

    await act(async () => {
      tenantBProducts.reject(new Error('tenant B products unavailable'));
      tenantBActivity.reject(new Error('tenant B activity unavailable'));
    });
    await waitFor(() => expect(screen.getByTestId('products-state')).toHaveTextContent('error:tenant-b:none'));
    expect(screen.getByTestId('activity-state')).toHaveTextContent('error:tenant-b:none');

    await act(async () => {
      tenantAProducts.resolve(productsFixture('tenant-a', 'A'));
      tenantAActivity.resolve(activityFixture('tenant-a', 'A'));
    });

    expect(screen.getByTestId('products-state')).toHaveTextContent('error:tenant-b:none');
    expect(screen.getByTestId('activity-state')).toHaveTextContent('error:tenant-b:none');
    expect(screen.queryByText('product-row:A')).not.toBeInTheDocument();
    expect(screen.queryByText('activity-row:A')).not.toBeInTheDocument();
  });

  it('shows same-tenant retained values as refreshing and retained-error after a production-key refetch', async () => {
    const refreshProducts = deferred<ProductsResponse>();
    getProductsMock.mockResolvedValueOnce(productsFixture('tenant-a', 'A')).mockReturnValueOnce(refreshProducts.promise);
    getActivityFeedMock.mockResolvedValueOnce(activityFixture('tenant-a', 'A'));
    const queryClient = createQueryClient();
    renderProductionSeller(queryClient, 'membership-a', 'tenant-a');
    const productOptions = productsQueryOptions({ archived: 'active', limit: 6, page: 1, tenantId: 'tenant-a' });

    await waitFor(() => expect(screen.getByTestId('products-state')).toHaveTextContent('ready:tenant-a:101'));
    expect(screen.getByText('product-row:A')).toBeVisible();

    const refetch = queryClient.refetchQueries({ queryKey: productOptions.queryKey, type: 'active' });
    await waitFor(() => expect(screen.getByTestId('products-state')).toHaveTextContent('refreshing:tenant-a:101'));
    expect(screen.getByText('product-row:A')).toBeVisible();

    await act(async () => {
      refreshProducts.reject(new Error('same tenant refresh failed'));
    });
    await refetch;

    await waitFor(() => expect(screen.getByTestId('products-state')).toHaveTextContent('retained-error:tenant-a:101'));
    expect(screen.getByText('product-row:A')).toBeVisible();
    expect(screen.getByTestId('activity-state')).toHaveTextContent('ready:tenant-a:201');
  });
});

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function productsFixture(tenantId: string, label: string) {
  return {
    items: [{ id: `engagement-${label}`, tenantId }],
    total: label === 'A' ? 101 : 102
  } as ProductsResponse;
}

function activityFixture(tenantId: string, label: string) {
  return {
    counters: { attentionCount: 201, staleCount: 0, todayCount: label === 'A' ? 201 : 202 },
    items: [
      {
        kind: 'movement',
        property: { engagementId: `engagement-${label}` },
        propertyEngagementId: `engagement-${label}`,
        tenantId
      }
    ]
  } as ActivityFeedResponse;
}

function productionSeller(queryClient: QueryClient, membershipId: string, tenantId: string) {
  return (
    <QueryClientProvider client={queryClient}>
      <SellerOperationalHomepage key={`${membershipId}:${tenantId}`} activeTenantId={tenantId}>
        {({ activity, products }) => {
          const productData = 'data' in products ? products.data : undefined;
          const activityData = 'data' in activity ? activity.data : undefined;
          return (
            <section>
              <output data-testid='products-state'>
                {`${products.status}:${products.tenantId}:${productData?.total ?? 'none'}`}
              </output>
              <output data-testid='activity-state'>
                {`${activity.status}:${activity.tenantId}:${activityData?.counters.todayCount ?? 'none'}`}
              </output>
              {productData?.items.map((item) => <p key={item.id}>{`product-row:${item.id.slice(-1)}`}</p>)}
              {activityData?.items.map((item) => <p key={item.propertyEngagementId}>{`activity-row:${item.propertyEngagementId.slice(-1)}`}</p>)}
              {productData ? <p>{`product-value:${productData.total}`}</p> : null}
              {activityData ? <p>{`activity-value:${activityData.counters.todayCount}`}</p> : null}
            </section>
          );
        }}
      </SellerOperationalHomepage>
    </QueryClientProvider>
  );
}

function renderProductionSeller(queryClient: QueryClient, membershipId: string, tenantId: string) {
  return render(productionSeller(queryClient, membershipId, tenantId));
}

function expectProductionOptions(queryClient: QueryClient, tenantId: string) {
  const productOptions = productsQueryOptions({ archived: 'active', limit: 6, page: 1, tenantId });
  const activityOptions = activityFeedOptions({ kind: 'all', page: 1, pageSize: 6, tenantId });
  const productsQuery = queryClient.getQueryCache().find({ queryKey: productOptions.queryKey });
  const activityQuery = queryClient.getQueryCache().find({ queryKey: activityOptions.queryKey });

  expect(productOptions.queryKey).toContainEqual(expect.objectContaining({ tenantId }));
  expect(activityOptions.queryKey).toContainEqual(expect.objectContaining({ tenantId }));
  expect(productsQuery?.options).toMatchObject({ refetchOnReconnect: false, refetchOnWindowFocus: false });
  expect(activityQuery?.options).toMatchObject({ refetchOnReconnect: false, refetchOnWindowFocus: false });
  expect(productsQuery?.queryKey).not.toEqual(activityQuery?.queryKey);
}

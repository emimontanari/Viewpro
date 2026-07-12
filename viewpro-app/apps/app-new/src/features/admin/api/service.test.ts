import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminDashboardData,
  getAdminSummary,
  listAdminActivity,
  listAdminTenants,
  updateAdminTenantLimits,
  updateAdminTenantStatus
} from './service';

const summaryResponse = {
  totals: {
    tenants: 3,
    activeTenants: 1,
    users: 12,
    activeEngagements: 8,
    documentRequests: 5,
    analyticsEvents: 40
  },
  recentActivityCount: 4,
  generatedAt: '2026-06-04T10:00:00.000Z'
};

const tenantsResponse = {
  total: 1,
  page: 2,
  pageSize: 5,
  items: [
    {
      id: 'tenant-1',
      name: 'Costa Norte Propiedades',
      slug: 'costa-norte',
      status: 'ACTIVE',
      limits: {
        maxUsers: null,
        maxActivePropertyEngagements: null,
        maxDocumentsStorageMb: null
      },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z',
      counts: {
        memberships: 3,
        propertyAssets: 4,
        propertyEngagements: 5,
        documentRequests: 6,
        analyticsEvents: 7
      },
      lastActivityAt: '2026-06-01T10:00:00.000Z'
    }
  ]
};

const activityResponse = {
  total: 1,
  page: 1,
  pageSize: 10,
  items: [
    {
      id: 'event-1',
      tenantId: 'tenant-1',
      eventName: 'TENANT_STATUS_CHANGED',
      actorType: 'INTERNAL_USER',
      propertyEngagementId: null,
      propertyAssetId: null,
      documentRequestId: null,
      movementId: null,
      occurredAt: '2026-06-04T10:00:00.000Z'
    }
  ]
};

const limitsUpdateResponse = {
  tenantId: 'tenant-1',
  previousLimits: {
    maxUsers: null,
    maxActivePropertyEngagements: null,
    maxDocumentsStorageMb: null
  },
  limits: {
    maxUsers: 12,
    maxActivePropertyEngagements: null,
    maxDocumentsStorageMb: 2048
  },
  unchanged: false,
  updatedAt: '2026-06-04T10:00:00.000Z'
};

const statusUpdateResponse = {
  tenantId: 'tenant-1',
  previousStatus: 'ACTIVE',
  status: 'SUSPENDED',
  unchanged: false,
  updatedAt: '2026-06-04T10:00:00.000Z'
};

describe('admin API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the admin summary through the local BFF route', async () => {
    const fetchMock = mockFetchSequence(summaryResponse);

    await expect(getAdminSummary()).resolves.toEqual(summaryResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/summary',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('serializes tenant filters for the admin tenants BFF route', async () => {
    const fetchMock = mockFetchSequence(tenantsResponse);

    await expect(listAdminTenants({ page: 2, pageSize: 5, status: 'SUSPENDED' })).resolves.toEqual(
      tenantsResponse
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/tenants?page=2&pageSize=5&status=SUSPENDED',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('serializes activity filters for the admin activity BFF route', async () => {
    const fetchMock = mockFetchSequence(activityResponse);

    await expect(
      listAdminActivity({ page: 3, pageSize: 20, tenantId: 'tenant-1' })
    ).resolves.toEqual(activityResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/activity?page=3&pageSize=20&tenantId=tenant-1',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('updates tenant limits with a PATCH JSON payload', async () => {
    const fetchMock = mockFetchSequence(limitsUpdateResponse);
    const payload = {
      maxUsers: 12,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: 2048
    };

    await expect(updateAdminTenantLimits('tenant 1', payload)).resolves.toEqual(
      limitsUpdateResponse
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/tenants/tenant%201/limits',
      expect.objectContaining({
        body: JSON.stringify(payload),
        cache: 'no-store',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('updates tenant status with a PATCH JSON payload', async () => {
    const fetchMock = mockFetchSequence(statusUpdateResponse);

    await expect(updateAdminTenantStatus('tenant 1', { status: 'SUSPENDED' })).resolves.toEqual(
      statusUpdateResponse
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/tenants/tenant%201/status',
      expect.objectContaining({
        body: JSON.stringify({ status: 'SUSPENDED' }),
        cache: 'no-store',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('loads summary, tenants, and activity in one dashboard request helper', async () => {
    const fetchMock = mockFetchSequence(summaryResponse, tenantsResponse, activityResponse);

    await expect(getAdminDashboardData()).resolves.toEqual({
      activity: activityResponse,
      summary: summaryResponse,
      tenants: tenantsResponse
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/summary',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/admin/tenants?page=1&pageSize=10',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/admin/activity?page=1&pageSize=10',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('raises Spanish-facing errors from BFF responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'No se pudo cargar el admin.' }), {
          headers: { 'content-type': 'application/json' },
          status: 500,
          statusText: 'Internal Server Error'
        })
      )
    );

    await expect(getAdminSummary()).rejects.toThrow('No se pudo cargar el admin.');
  });
});

function mockFetchSequence(...bodies: unknown[]) {
  const fetchMock = vi.fn();

  bodies.forEach((body) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

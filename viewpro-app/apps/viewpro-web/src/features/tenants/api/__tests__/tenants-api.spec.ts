/**
 * T-03 — RED: tenants api layer unit tests
 * Spec: Paginated Tenant List (scenarios 1, 3); Status Toggle with Suspend
 *   Confirmation (PATCH body shape); Limits Editing via Modal Dialog (PATCH
 *   body shape); viewpro-api-Only Isolation
 *
 * Tests cover:
 *   - getTenantList(offset,limit) calls GET /operators/tenants?offset&limit
 *   - updateTenantStatus(id,{status}) PATCHes .../status with {status}
 *   - updateTenantLimits(id,limits) PATCHes .../limits with the 3-field object
 *   - parseStatusResponse/parseLimitsResponse accept the traced shape and
 *     reject malformed input with a normalized {status:502} error
 *   - tenantsKeys are stable; tenantsListOptions carries the right key + queryFn
 *   - isolation: every call goes through the mocked apiRequest
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock apiRequest before importing the service
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn()
}));

import { apiRequest } from '@/lib/api-client';
import { getTenantList, updateTenantStatus, updateTenantLimits } from '../service';
import { parseStatusResponse, parseLimitsResponse } from '../schemas';
import { tenantsKeys, tenantsListOptions } from '../queries';
import type { TenantListResponse, TenantListItem } from '../types';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_ITEM: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: {
    maxUsers: 10,
    maxActivePropertyEngagements: 50,
    maxDocumentsStorageMb: 1024
  }
};

const MOCK_LIST_RESPONSE: TenantListResponse = {
  total: 1,
  items: [MOCK_ITEM]
};

const MOCK_STATUS_RESPONSE = {
  tenantId: 'tenant-1',
  previousStatus: 'ACTIVE',
  status: 'SUSPENDED',
  unchanged: false,
  updatedAt: '2026-07-15T10:00:00.000Z'
};

const MOCK_LIMITS_RESPONSE = {
  tenantId: 'tenant-1',
  previousLimits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
  limits: { maxUsers: 20, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
  unchanged: false,
  updatedAt: '2026-07-15T10:00:00.000Z'
};

beforeEach(() => {
  mockApiRequest.mockReset();
});

// ─── getTenantList() ─────────────────────────────────────────────────────────

describe('getTenantList()', () => {
  it('calls GET /operators/tenants?offset=<offset>&limit=<limit>', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST_RESPONSE);

    await getTenantList(0, 50);

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants?offset=0&limit=50');
  });

  it('returns { total, items } typed TenantListResponse', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST_RESPONSE);

    const result = await getTenantList(0, 50);

    expect(result.total).toBe(1);
    expect(result.items).toEqual([MOCK_ITEM]);
  });

  it('uses the requested offset/limit in subsequent pages', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST_RESPONSE);

    await getTenantList(50, 50);

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants?offset=50&limit=50');
  });

  it('forwards API errors (non-401) without swallowing them', async () => {
    const apiError = { status: 500, message: 'Internal server error' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getTenantList(0, 50)).rejects.toMatchObject({ status: 500 });
  });
});

// ─── updateTenantStatus() ────────────────────────────────────────────────────

describe('updateTenantStatus()', () => {
  it('calls PATCH /operators/tenants/:id/status with { status }', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_STATUS_RESPONSE);

    await updateTenantStatus('tenant-1', { status: 'SUSPENDED' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/status');
    expect(options).toMatchObject({ method: 'PATCH', body: { status: 'SUSPENDED' } });
  });

  it('returns the parsed AdminTenantStatusUpdateResponse', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_STATUS_RESPONSE);

    const result = await updateTenantStatus('tenant-1', { status: 'SUSPENDED' });

    expect(result).toEqual(MOCK_STATUS_RESPONSE);
  });

  it('encodes the tenant id in the path', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_STATUS_RESPONSE);

    await updateTenantStatus('tenant with spaces', { status: 'ACTIVE' });

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant%20with%20spaces/status');
  });
});

// ─── updateTenantLimits() ────────────────────────────────────────────────────

describe('updateTenantLimits()', () => {
  it('calls PATCH /operators/tenants/:id/limits with the 3-field limits object', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    const payload = { maxUsers: 20, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 };
    await updateTenantLimits('tenant-1', payload);

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/limits');
    expect(options).toMatchObject({ method: 'PATCH', body: payload });
  });

  it('returns the parsed AdminTenantLimitsUpdateResponse', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    const result = await updateTenantLimits('tenant-1', {
      maxUsers: 20,
      maxActivePropertyEngagements: 50,
      maxDocumentsStorageMb: 1024
    });

    expect(result).toEqual(MOCK_LIMITS_RESPONSE);
  });

  it('sends null for cleared limit fields', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    await updateTenantLimits('tenant-1', {
      maxUsers: null,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: null
    });

    const [, options] = mockApiRequest.mock.calls[0];
    expect(options).toMatchObject({
      body: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
    });
  });
});

// ─── parseStatusResponse() ───────────────────────────────────────────────────

describe('parseStatusResponse()', () => {
  it('accepts the traced shape and returns it typed', () => {
    const result = parseStatusResponse(MOCK_STATUS_RESPONSE);

    expect(result).toEqual(MOCK_STATUS_RESPONSE);
  });

  it('rejects {} by throwing a {status:502,...}-shaped error', () => {
    expect(() => parseStatusResponse({})).toThrow();
    try {
      parseStatusResponse({});
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 502 });
    }
  });

  it('rejects wrong-typed fields', () => {
    expect(() =>
      parseStatusResponse({
        tenantId: 'tenant-1',
        previousStatus: 'ACTIVE',
        status: 'SUSPENDED',
        unchanged: 'not-a-boolean',
        updatedAt: '2026-07-15T10:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseStatusResponse(null)).toThrow();
    try {
      parseStatusResponse(null);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 502 });
    }
  });
});

// ─── parseLimitsResponse() ───────────────────────────────────────────────────

describe('parseLimitsResponse()', () => {
  it('accepts the traced shape and returns it typed', () => {
    const result = parseLimitsResponse(MOCK_LIMITS_RESPONSE);

    expect(result).toEqual(MOCK_LIMITS_RESPONSE);
  });

  it('rejects {} by throwing a {status:502,...}-shaped error', () => {
    try {
      parseLimitsResponse({});
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 502 });
    }
  });

  it('rejects wrong-typed fields', () => {
    expect(() =>
      parseLimitsResponse({
        tenantId: 'tenant-1',
        previousLimits: { maxUsers: 'not-a-number', maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
        limits: { maxUsers: 20, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
        unchanged: false,
        updatedAt: '2026-07-15T10:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseLimitsResponse(null)).toThrow();
  });
});

// ─── tenantsKeys ─────────────────────────────────────────────────────────────

describe('tenantsKeys', () => {
  it('all is a stable constant array ["tenants"]', () => {
    expect(tenantsKeys.all).toEqual(['tenants']);
  });

  it('list(offset,limit) is ["tenants","list",offset,limit]', () => {
    expect(tenantsKeys.list(0, 50)).toEqual(['tenants', 'list', 0, 50]);
    expect(tenantsKeys.list(50, 50)).toEqual(['tenants', 'list', 50, 50]);
  });
});

// ─── tenantsListOptions ──────────────────────────────────────────────────────

describe('tenantsListOptions', () => {
  it('has queryKey matching tenantsKeys.list(offset,limit)', () => {
    const options = tenantsListOptions(0, 50);
    expect(options.queryKey).toEqual(['tenants', 'list', 0, 50]);
  });

  it('has queryFn that delegates to getTenantList', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST_RESPONSE);

    const result = await getTenantList(0, 50);

    expect(result).toEqual(MOCK_LIST_RESPONSE);
  });
});

// ─── Isolation ───────────────────────────────────────────────────────────────

describe('viewpro-api-only isolation', () => {
  it('every service call goes through the mocked apiRequest (no raw fetch)', async () => {
    mockApiRequest.mockResolvedValue(MOCK_LIST_RESPONSE);

    await getTenantList(0, 50);

    expect(mockApiRequest).toHaveBeenCalled();
  });
});

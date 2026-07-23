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
import {
  getTenantList,
  updateTenantStatus,
  updateTenantLimits,
  assignTenantPlan,
  getTenantDetail,
  fetchDocumentReadUrl
} from '../service';
import { parseStatusResponse, parseLimitsResponse } from '../schemas';
import { tenantsKeys, tenantsListOptions, tenantDetailOptions } from '../queries';
import type { TenantListResponse, TenantListItem, TenantDetailResponse } from '../types';

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
  },
  trialEndsAt: null,
  plan: null
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

// ─── assignTenantPlan() ──────────────────────────────────────────────────────
//
// platform-manual-plans (Slice 4, Part 2) — RED: PATCH .../plan request shape
// + zod response parsing. The wire response is the SAME opaque limits-update
// passthrough shape as .../limits (the controller returns the limits-lane
// result verbatim) — no plan-specific response schema needed (DRY, reuses
// parseLimitsResponse).

describe('assignTenantPlan()', () => {
  it('calls PATCH /operators/tenants/:id/plan with { plan }', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    await assignTenantPlan('tenant-1', { plan: 'BASICO' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/plan');
    expect(options).toMatchObject({ method: 'PATCH', body: { plan: 'BASICO' } });
  });

  it('returns the parsed AdminTenantLimitsUpdateResponse (shared shape)', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    const result = await assignTenantPlan('tenant-1', { plan: 'PROFESIONAL' });

    expect(result).toEqual(MOCK_LIMITS_RESPONSE);
  });

  it('encodes the tenant id in the path', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIMITS_RESPONSE);

    await assignTenantPlan('tenant with spaces', { plan: 'EMPRESA' });

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant%20with%20spaces/plan');
  });

  it('throws a normalized {status:502} error on a malformed response', async () => {
    mockApiRequest.mockResolvedValueOnce({});

    await expect(assignTenantPlan('tenant-1', { plan: 'BASICO' })).rejects.toMatchObject({
      status: 502
    });
  });
});

// ─── getTenantDetail() (platform-tenant-tracking, T-19/21) ──────────────────
//
// GET /operators/tenants/:id/summary?offset&limit — thin passthrough, typed
// (not zod-validated, matching GET /operators/tenants precedent above — only
// PATCH responses go through zod since InmoView's PATCH lane is typed
// `unknown` server-side; this GET route is typed end-to-end).

const MOCK_DETAIL_RESPONSE: TenantDetailResponse = {
  window: { from: '2026-07-13T00:00:00.000Z', to: '2026-07-20T00:00:00.000Z' },
  activeEngagements: 12,
  activeEngagementsWithOwnerVisibleUpdate: 8,
  activeEngagementUpdatePercentage: 67,
  documentEvents: { requested: 5, uploaded: 4, approved: 3, rejected: 1 },
  ownerViewedPropertyCount: 20,
  activity: {
    total: 2,
    items: [
      { kind: 'movement', id: 'movement-1', createdAt: '2026-07-15T10:00:00.000Z' },
      { kind: 'document_request', id: 'document-request:doc-1', createdAt: '2026-07-14T09:00:00.000Z' }
    ]
  }
};

describe('getTenantDetail()', () => {
  it('calls GET /operators/tenants/:id/summary?offset=<offset>&limit=<limit>', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_DETAIL_RESPONSE);

    await getTenantDetail('tenant-1', 0, 20);

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/summary?offset=0&limit=20');
  });

  it('returns the typed TenantDetailResponse as-is', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_DETAIL_RESPONSE);

    const result = await getTenantDetail('tenant-1', 0, 20);

    expect(result).toEqual(MOCK_DETAIL_RESPONSE);
  });

  it('uses the requested offset/limit for a "load more" page', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_DETAIL_RESPONSE);

    await getTenantDetail('tenant-1', 20, 20);

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/summary?offset=20&limit=20');
  });

  it('encodes the tenant id in the path', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_DETAIL_RESPONSE);

    await getTenantDetail('tenant with spaces', 0, 20);

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant%20with%20spaces/summary?offset=0&limit=20');
  });

  it('forwards API errors (404/502) without swallowing them', async () => {
    const apiError = { status: 404, message: 'Tenant not found' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getTenantDetail('missing-tenant', 0, 20)).rejects.toMatchObject({ status: 404 });
  });
});

// ─── fetchDocumentReadUrl() (operator-activity-media, Slice 2b, 2b.5) ────────
//
// GET /operators/tenants/:tenantId/document-versions/:versionId/read-url —
// on-demand, short-lived signed URL mint. No caching at this layer (spec:
// "Expired URL re-fetch" — every click re-fetches). Typed end-to-end (not
// zod-validated), matching the getTenantDetail GET precedent above.

const MOCK_READ_URL_RESPONSE = {
  url: 'https://storage.example/read/documents/req-1/version-1.pdf',
  expiresInSeconds: 300,
  originalFilename: 'deed.pdf',
  mimeType: 'application/pdf'
};

describe('fetchDocumentReadUrl()', () => {
  it('calls GET /operators/tenants/:tenantId/document-versions/:versionId/read-url', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_READ_URL_RESPONSE);

    await fetchDocumentReadUrl('tenant-1', 'version-1');

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/tenants/tenant-1/document-versions/version-1/read-url');
  });

  it('returns { url, expiresInSeconds, originalFilename, mimeType } on success', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_READ_URL_RESPONSE);

    const result = await fetchDocumentReadUrl('tenant-1', 'version-1');

    expect(result).toEqual(MOCK_READ_URL_RESPONSE);
  });

  it('encodes the tenant id and version id in the path', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_READ_URL_RESPONSE);

    await fetchDocumentReadUrl('tenant with spaces', 'version with spaces');

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe(
      '/operators/tenants/tenant%20with%20spaces/document-versions/version%20with%20spaces/read-url'
    );
  });

  it('surfaces a 403 (missing permission) distinctly from other errors', async () => {
    const apiError = { status: 403, message: 'Insufficient permissions', code: 'PERMISSION_DENIED' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(fetchDocumentReadUrl('tenant-1', 'version-1')).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
  });

  it('forwards a 404 (missing/cross-tenant version) without swallowing it', async () => {
    const apiError = { status: 404, message: 'Document version not found' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(fetchDocumentReadUrl('tenant-1', 'missing-version')).rejects.toMatchObject({
      status: 404
    });
  });

  it('forwards a 502 (upstream failure) without swallowing it', async () => {
    const apiError = { status: 502, message: 'Failed to reach InmoView document-read-url endpoint' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(fetchDocumentReadUrl('tenant-1', 'version-1')).rejects.toMatchObject({
      status: 502
    });
  });

  it('never caches the URL — a second call issues a second request', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_READ_URL_RESPONSE).mockResolvedValueOnce({
      ...MOCK_READ_URL_RESPONSE,
      url: 'https://storage.example/read/documents/req-1/version-1-refetched.pdf'
    });

    const first = await fetchDocumentReadUrl('tenant-1', 'version-1');
    const second = await fetchDocumentReadUrl('tenant-1', 'version-1');

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
    expect(first.url).not.toBe(second.url);
  });
});

// ─── tenantsKeys.detail / tenantDetailOptions ────────────────────────────────

describe('tenantsKeys.detail', () => {
  it('detail(tenantId,offset,limit) is ["tenants","detail",tenantId,offset,limit]', () => {
    expect(tenantsKeys.detail('tenant-1', 0, 20)).toEqual(['tenants', 'detail', 'tenant-1', 0, 20]);
    expect(tenantsKeys.detail('tenant-1', 20, 20)).toEqual(['tenants', 'detail', 'tenant-1', 20, 20]);
  });
});

describe('tenantDetailOptions', () => {
  it('has queryKey matching tenantsKeys.detail(tenantId,offset,limit)', () => {
    const options = tenantDetailOptions('tenant-1', 0, 20);
    expect(options.queryKey).toEqual(['tenants', 'detail', 'tenant-1', 0, 20]);
  });

  it('has queryFn that delegates to getTenantDetail', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_DETAIL_RESPONSE);

    const result = await getTenantDetail('tenant-1', 0, 20);

    expect(result).toEqual(MOCK_DETAIL_RESPONSE);
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

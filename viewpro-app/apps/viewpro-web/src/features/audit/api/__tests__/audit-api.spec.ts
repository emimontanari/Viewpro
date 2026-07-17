/**
 * T-22 — RED: features/audit api layer unit tests
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (implicit — feed
 *   fetch/parse); design Testing Strategy — FE zod parse tolerates
 *   absent/malformed previousValue/newValue (R4)
 *
 * Tests cover:
 *   - getAuditFeed(offset,limit) calls GET /operators/audit?offset&limit
 *   - zod-parses the response into AuditFeedResponse
 *   - malformed/absent previousValue/newValue (missing, null, non-object)
 *     does NOT throw during parse (z.unknown())
 *   - malformed top-level response (missing items) throws a normalized
 *     ApiError-shaped error (mirrors PARSE_ERROR pattern)
 *   - auditKeys are stable; auditFeedOptions carries the right key + queryFn
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock apiRequest before importing the service
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn()
}));

import { apiRequest } from '@/lib/api-client';
import { getAuditFeed } from '../service';
import { parseAuditFeedResponse } from '../schemas';
import { auditKeys, auditFeedOptions } from '../queries';
import type { AuditFeedResponse, AuditLogItem } from '../types';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_ITEM: AuditLogItem = {
  id: 'audit-1',
  action: 'TENANT_STATUS_CHANGED',
  tenantId: 'tenant-1',
  actor: { id: 'op-1', type: 'operator', label: 'op-1' },
  previousValue: { status: 'TRIAL' },
  newValue: { status: 'ACTIVE' },
  occurredAt: '2026-07-15T10:00:00.000Z',
  seqNo: 3
};

const MOCK_FEED_RESPONSE: AuditFeedResponse = {
  total: 1,
  items: [MOCK_ITEM]
};

// A4 — the audit feed is HETEROGENEOUS: alongside the InmoView-outbox entries
// (MOCK_ITEM above), operator-management actions emit VIEWPRO_NATIVE entries
// with a different shape: actor {id,email} (no type/label), a target
// {id,email}, tenantId/seqNo null, and a source discriminator. The FE schema
// must tolerate BOTH so a single native entry never fails the whole feed.
const MOCK_NATIVE_ITEM = {
  id: 'audit-native-1',
  action: 'OPERATOR_CREATED',
  tenantId: null,
  actor: { id: 'op-9', email: 'admin@viewpro.local' },
  target: { id: 'op-10', email: 'demo.operador@viewpro.local' },
  previousValue: null,
  newValue: null,
  occurredAt: '2026-07-15T11:00:00.000Z',
  seqNo: null,
  source: 'VIEWPRO_NATIVE'
};

beforeEach(() => {
  mockApiRequest.mockReset();
});

// ─── getAuditFeed() ──────────────────────────────────────────────────────────

describe('getAuditFeed()', () => {
  it('calls GET /operators/audit?offset=<offset>&limit=<limit>', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_FEED_RESPONSE);

    await getAuditFeed(0, 50);

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/audit?offset=0&limit=50');
  });

  it('returns { total, items } typed AuditFeedResponse', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_FEED_RESPONSE);

    const result = await getAuditFeed(0, 50);

    expect(result.total).toBe(1);
    expect(result.items).toEqual([MOCK_ITEM]);
  });

  it('uses the requested offset/limit in subsequent pages', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_FEED_RESPONSE);

    await getAuditFeed(50, 50);

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/audit?offset=50&limit=50');
  });

  it('forwards API errors (non-401) without swallowing them', async () => {
    const apiError = { status: 500, message: 'Internal server error' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getAuditFeed(0, 50)).rejects.toMatchObject({ status: 500 });
  });
});

// ─── parseAuditFeedResponse() ────────────────────────────────────────────────

describe('parseAuditFeedResponse()', () => {
  it('accepts the traced shape and returns it typed', () => {
    const result = parseAuditFeedResponse(MOCK_FEED_RESPONSE);

    expect(result).toEqual(MOCK_FEED_RESPONSE);
  });

  it('tolerates a missing previousValue (never throws — z.unknown())', () => {
    const raw = {
      total: 1,
      items: [{ ...MOCK_ITEM, previousValue: undefined }]
    };

    expect(() => parseAuditFeedResponse(raw)).not.toThrow();
  });

  it('tolerates a null previousValue/newValue (never throws)', () => {
    const raw = {
      total: 1,
      items: [{ ...MOCK_ITEM, previousValue: null, newValue: null }]
    };

    expect(() => parseAuditFeedResponse(raw)).not.toThrow();
  });

  it('tolerates a non-object previousValue/newValue (never throws)', () => {
    const raw = {
      total: 1,
      items: [{ ...MOCK_ITEM, previousValue: 'ACTIVE', newValue: 42 }]
    };

    expect(() => parseAuditFeedResponse(raw)).not.toThrow();
  });

  it('rejects a malformed top-level response (missing items) with a {status:502,...} error', () => {
    try {
      parseAuditFeedResponse({ total: 1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 502 });
    }
  });

  it('accepts a heterogeneous feed (outbox + native) without throwing', () => {
    const raw = {
      total: 2,
      items: [MOCK_ITEM, MOCK_NATIVE_ITEM]
    };

    expect(() => parseAuditFeedResponse(raw)).not.toThrow();

    const result = parseAuditFeedResponse(raw);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({
      id: 'audit-native-1',
      action: 'OPERATOR_CREATED',
      tenantId: null,
      seqNo: null,
      source: 'VIEWPRO_NATIVE',
      actor: { id: 'op-9', email: 'admin@viewpro.local' },
      target: { id: 'op-10', email: 'demo.operador@viewpro.local' }
    });
  });

  it('accepts a lone native entry (actor without type/label, target present)', () => {
    const raw = {
      total: 1,
      items: [MOCK_NATIVE_ITEM]
    };

    expect(() => parseAuditFeedResponse(raw)).not.toThrow();
  });

  it('rejects null', () => {
    expect(() => parseAuditFeedResponse(null)).toThrow();
    try {
      parseAuditFeedResponse(null);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 502 });
    }
  });
});

// ─── auditKeys ────────────────────────────────────────────────────────────────

describe('auditKeys', () => {
  it('all is a stable constant array ["audit"]', () => {
    expect(auditKeys.all).toEqual(['audit']);
  });

  it('list(offset,limit) is ["audit","list",offset,limit]', () => {
    expect(auditKeys.list(0, 50)).toEqual(['audit', 'list', 0, 50]);
    expect(auditKeys.list(50, 50)).toEqual(['audit', 'list', 50, 50]);
  });
});

// ─── auditFeedOptions ───────────────────────────────────────────────────────

describe('auditFeedOptions', () => {
  it('has queryKey matching auditKeys.list(offset,limit)', () => {
    const options = auditFeedOptions(0, 50);
    expect(options.queryKey).toEqual(['audit', 'list', 0, 50]);
  });

  it('has queryFn that delegates to getAuditFeed', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_FEED_RESPONSE);

    const result = await getAuditFeed(0, 50);

    expect(result).toEqual(MOCK_FEED_RESPONSE);
  });
});

// ─── Isolation ───────────────────────────────────────────────────────────────

describe('viewpro-api-only isolation', () => {
  it('every service call goes through the mocked apiRequest (no raw fetch)', async () => {
    mockApiRequest.mockResolvedValue(MOCK_FEED_RESPONSE);

    await getAuditFeed(0, 50);

    expect(mockApiRequest).toHaveBeenCalled();
  });
});

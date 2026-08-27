import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JwtService } from '@nestjs/jwt'
import { ChangeFeedClient } from '../change-feed.client'

/**
 * T-15 — RED: ChangeFeedClient unit tests.
 *
 * Spec: platform-data-lane-ingest-metrics — Interval Poll Job (env config + overlap guard);
 *   poller uses persisted cursor; Data-Lane Environment Configuration.
 */

const PLATFORM_CONTROL_SECRET = 'test-platform-control-secret-min16'
const INMOVIEW_API_INTERNAL_URL = 'http://localhost:3001'

describe('ChangeFeedClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fetchChanges calls GET INMOVIEW_API_INTERNAL_URL/api/internal/platform/changes?since=<cursor>', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ events: [], nextCursor: 5 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(5)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`${INMOVIEW_API_INTERNAL_URL}/api/internal/platform/changes?since=5`)
  })

  it('fetchChanges includes Authorization: Bearer <HS256 JWT> header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ events: [], nextCursor: 0 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(0)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const authHeader = (init.headers as Record<string, string>)['Authorization']
    expect(authHeader).toMatch(/^Bearer /)
  })

  it('[S1] service token contains a jti claim (unique token ID for PlatformServiceIdentity.tokenId)', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(
        new Response(JSON.stringify({ events: [], nextCursor: 0 }), { status: 200 }),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(0)

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')

    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    // S1: jti must be present and be a non-empty UUID string
    expect(typeof payload.jti).toBe('string')
    expect(payload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('[S1] consecutive fetchChanges calls produce tokens with distinct jti values', async () => {
    const capturedJtis: string[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const token = (headers['Authorization'] ?? '').replace('Bearer ', '')
      // Synchronously decode (no verify) to inspect the jti
      const parts = token.split('.')
      if (parts[1]) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as { jti?: string }
        if (decoded.jti) capturedJtis.push(decoded.jti)
      }
      return Promise.resolve(
        new Response(JSON.stringify({ events: [], nextCursor: 0 }), { status: 200 }),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(0)
    await client.fetchChanges(0)

    expect(capturedJtis).toHaveLength(2)
    expect(capturedJtis[0]).not.toBe(capturedJtis[1])
  })

  it('service token decodes with PLATFORM_CONTROL_SECRET and contains iss=viewpro-api, aud=inmoview-control', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(
        new Response(JSON.stringify({ events: [], nextCursor: 0 }), { status: 200 }),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(0)

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')

    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    expect(payload.iss).toBe('viewpro-api')
    expect(payload.aud).toBe('inmoview-control')
    const nowSec = Math.floor(Date.now() / 1000)
    expect(payload.exp).toBeGreaterThanOrEqual(nowSec + 100)
    expect(payload.exp).toBeLessThanOrEqual(nowSec + 140)
  })

  it('service token fails verification with wrong secret', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(
        new Response(JSON.stringify({ events: [], nextCursor: 0 }), { status: 200 }),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchChanges(0)

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')

    const wrongVerifier = new JwtService({ secret: 'wrong-secret-completely-different' })
    await expect(wrongVerifier.verifyAsync(token)).rejects.toThrow('invalid signature')
  })

  it('fetchChanges returns parsed ChangeFeedResponse', async () => {
    const mockResponse = {
      events: [
        {
          id: 'evt-1',
          seqNo: 1,
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 't-1',
          payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
          occurredAt: new Date().toISOString(),
        },
      ],
      nextCursor: 1,
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const result = await client.fetchChanges(0)

    expect(result.nextCursor).toBe(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.id).toBe('evt-1')
  })

  it('fetchChanges throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchChanges(0)).rejects.toThrow('Data-lane change-feed returned non-2xx')
  })

  it('fetchChanges aborts stalled body parsing after two seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    } as Response)))
    const client = new ChangeFeedClient({ inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL, platformControlSecret: PLATFORM_CONTROL_SECRET })
    const request = client.fetchChanges(0)

    await Promise.resolve()
    const assertion = expect(request).rejects.toMatchObject({ name: 'ChangeFeedTimeoutError' })
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
  })

  // -------------------------------------------------------------------------
  // T-21/T-22 — RED: fetchAllTenants (backfill pull) — A12
  // -------------------------------------------------------------------------
  it('fetchAllTenants calls GET INMOVIEW_API_INTERNAL_URL/api/internal/platform/tenants', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tenants: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchAllTenants()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${INMOVIEW_API_INTERNAL_URL}/api/internal/platform/tenants`)
  })

  it('fetchAllTenants mints a service token with the same claims as fetchChanges (iss=viewpro-api, aud=inmoview-control)', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(new Response(JSON.stringify({ tenants: [] }), { status: 200 }))
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchAllTenants()

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')
    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    expect(payload.iss).toBe('viewpro-api')
    expect(payload.aud).toBe('inmoview-control')
    expect(payload.sub).toBe('system-ingest')
  })

  it('fetchAllTenants returns the parsed { tenants: [...] } body', async () => {
    const mockBody = {
      tenants: [
        {
          id: 't-1',
          name: 'Alpha',
          slug: 'alpha',
          status: 'TRIAL',
          limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
        },
        {
          id: 't-2',
          name: 'Beta',
          slug: 'beta',
          status: 'ACTIVE',
          limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
        },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockBody), { status: 200 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const result = await client.fetchAllTenants()

    expect(result.tenants).toHaveLength(2)
    expect(result.tenants[0]?.id).toBe('t-1')
    expect(result.tenants[1]?.status).toBe('ACTIVE')
  })

  it('fetchAllTenants throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchAllTenants()).rejects.toThrow('Backfill tenants endpoint returned non')
  })

  // -------------------------------------------------------------------------
  // platform-tenant-tracking (PR1) — RED: fetchTenantSummary(tenantId, offset, limit)
  //
  // Spec: platform-tenant-tracking — "ViewPro tenant summary passthrough"
  // Design D7: extends ChangeFeedClient (not a new client class), mirrors the
  //   existing fetchChanges/fetchAllTenants HS256 token-minting.
  // -------------------------------------------------------------------------
  it('fetchTenantSummary calls GET INMOVIEW_API_INTERNAL_URL/api/internal/platform/tenants/:id/summary?offset=&limit=', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
          activeEngagements: 1,
          activeEngagementsWithOwnerVisibleUpdate: 0,
          activeEngagementUpdatePercentage: 0,
          documentEvents: { requested: 0, uploaded: 0, approved: 0, rejected: 0 },
          ownerViewedPropertyCount: 0,
          activity: { total: 0, items: [] },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchTenantSummary('tenant-1', 0, 20)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `${INMOVIEW_API_INTERNAL_URL}/api/internal/platform/tenants/tenant-1/summary?offset=0&limit=20`,
    )
  })

  it('fetchTenantSummary mints a service token with the same claims as fetchChanges (iss=viewpro-api, aud=inmoview-control)', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(
        new Response(
          JSON.stringify({
            window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
            activeEngagements: 0,
            activeEngagementsWithOwnerVisibleUpdate: 0,
            activeEngagementUpdatePercentage: 0,
            documentEvents: { requested: 0, uploaded: 0, approved: 0, rejected: 0 },
            ownerViewedPropertyCount: 0,
            activity: { total: 0, items: [] },
          }),
          { status: 200 },
        ),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchTenantSummary('tenant-1', 0, 20)

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')
    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    expect(payload.iss).toBe('viewpro-api')
    expect(payload.aud).toBe('inmoview-control')
    expect(payload.sub).toBe('system-ingest')
  })

  it('fetchTenantSummary returns the parsed summary body (counts + activity)', async () => {
    const mockBody = {
      window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
      activeEngagements: 3,
      activeEngagementsWithOwnerVisibleUpdate: 1,
      activeEngagementUpdatePercentage: 33,
      documentEvents: { requested: 2, uploaded: 1, approved: 1, rejected: 0 },
      ownerViewedPropertyCount: 4,
      activity: {
        total: 1,
        items: [{ kind: 'movement', id: 'movement-1', createdAt: '2026-05-22T10:00:00.000Z' }],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockBody), { status: 200 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const result = await client.fetchTenantSummary('tenant-1', 0, 20)

    expect(result.activeEngagements).toBe(3)
    expect(result.activity.total).toBe(1)
    expect(result.activity.items).toHaveLength(1)
  })

  it('fetchTenantSummary throws on non-2xx response (mapped to a typed error by the caller)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
    ))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchTenantSummary('does-not-exist', 0, 20)).rejects.toThrow('Tenant-summary endpoint returned non')
  })

  it('fetchTenantSummary throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchTenantSummary('tenant-1', 0, 20)).rejects.toThrow('Tenant-summary request to InmoView')
  })

  // -------------------------------------------------------------------------
  // operator-activity-media (Slice 2a) — RED: fetchDocumentReadUrl(tenantId, versionId)
  //
  // Spec: operator-document-read — Permission-Gated Signed Read URL.
  // Design D5/D6: extends ChangeFeedClient (not a new client), 120s ingest
  //   JWT via mintIngestToken (same claims as fetchChanges/fetchTenantSummary),
  //   encodeURIComponent on both path segments (mirrors fetchTenantSummary:242).
  // -------------------------------------------------------------------------
  it('fetchDocumentReadUrl calls GET .../tenants/:tenantId/document-versions/:versionId/read-url', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          url: 'https://storage.example/read',
          expiresInSeconds: 300,
          originalFilename: 'deed.pdf',
          mimeType: 'application/pdf',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchDocumentReadUrl('tenant-1', 'version-1')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `${INMOVIEW_API_INTERNAL_URL}/api/internal/platform/tenants/tenant-1/document-versions/version-1/read-url`,
    )
  })

  it('fetchDocumentReadUrl passes an AbortSignal so a hung InmoView bounds the hot-path hop', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          url: 'https://storage.example/read',
          expiresInSeconds: 300,
          originalFilename: 'deed.pdf',
          mimeType: 'application/pdf',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchDocumentReadUrl('tenant-1', 'version-1')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal?.aborted).toBe(false)
  })

  it('fetchDocumentReadUrl encodeURIComponent-encodes both tenantId and versionId path segments', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ url: 'x', expiresInSeconds: 300, originalFilename: 'a.pdf', mimeType: 'application/pdf' }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchDocumentReadUrl('tenant/../evil', 'version?x=1')

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `${INMOVIEW_API_INTERNAL_URL}/api/internal/platform/tenants/${encodeURIComponent('tenant/../evil')}/document-versions/${encodeURIComponent('version?x=1')}/read-url`,
    )
  })

  it('fetchDocumentReadUrl mints a service token with the same claims as fetchChanges (iss=viewpro-api, aud=inmoview-control, sub=system-ingest)', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init.headers as Record<string, string>)
      return Promise.resolve(
        new Response(
          JSON.stringify({ url: 'x', expiresInSeconds: 300, originalFilename: 'a.pdf', mimeType: 'application/pdf' }),
          { status: 200 },
        ),
      )
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.fetchDocumentReadUrl('tenant-1', 'version-1')

    const authHeader = capturedHeaders[0]?.['Authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')
    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    expect(payload.iss).toBe('viewpro-api')
    expect(payload.aud).toBe('inmoview-control')
    expect(payload.sub).toBe('system-ingest')
    const nowSec = Math.floor(Date.now() / 1000)
    expect(payload.exp).toBeGreaterThanOrEqual(nowSec + 100)
    expect(payload.exp).toBeLessThanOrEqual(nowSec + 140)
  })

  it('fetchDocumentReadUrl returns the parsed {url, expiresInSeconds, originalFilename, mimeType} body', async () => {
    const mockBody = {
      url: 'https://storage.example/read/documents/req-1/version-1.pdf',
      expiresInSeconds: 300,
      originalFilename: 'deed.pdf',
      mimeType: 'application/pdf',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockBody), { status: 200 })))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const result = await client.fetchDocumentReadUrl('tenant-1', 'version-1')

    expect(result).toEqual(mockBody)
  })

  it('fetchDocumentReadUrl throws a DocumentReadUrlFetchError with status=404 (cross-tenant/missing propagated to the caller)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchDocumentReadUrl('tenant-1', 'does-not-exist')).rejects.toMatchObject({
      name: 'DocumentReadUrlFetchError',
      status: 404,
    })
  })

  it('fetchDocumentReadUrl throws a DocumentReadUrlFetchError with status=undefined on network failure (distinct from a 404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchDocumentReadUrl('tenant-1', 'version-1')).rejects.toMatchObject({
      name: 'DocumentReadUrlFetchError',
      status: undefined,
    })
  })

  it('fetchDocumentReadUrl throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const client = new ChangeFeedClient({
      inmoviewApiInternalUrl: INMOVIEW_API_INTERNAL_URL,
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await expect(client.fetchDocumentReadUrl('tenant-1', 'version-1')).rejects.toThrow('Document-read-url request to InmoView')
  })
})

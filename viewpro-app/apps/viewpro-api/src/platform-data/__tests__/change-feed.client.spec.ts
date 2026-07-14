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
      const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
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
    await expect(wrongVerifier.verifyAsync(token)).rejects.toThrow()
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

    await expect(client.fetchChanges(0)).rejects.toThrow()
  })
})

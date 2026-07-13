import { describe, it, expect, vi } from 'vitest'
import { JwtService } from '@nestjs/jwt'
import { HttpException } from '@nestjs/common'
import { PlatformControlClient } from '../platform-control.client'

/**
 * T-16 — RED: PlatformControlClient token minting tests.
 *
 * Spec: platform-control-lane-outbound — Service Token Minting (both scenarios)
 *  1. Token carries operator identity (callerId=op-1, signed with PLATFORM_CONTROL_SECRET)
 *  2. Token does NOT verify with ACCESS_TOKEN_SECRET
 */

const PLATFORM_CONTROL_SECRET = 'test-platform-control-secret-min16'
const ACCESS_TOKEN_SECRET = 'test-access-token-secret-different'
const OPERATOR_ID = 'op-1'

describe('PlatformControlClient — token minting', () => {

  it('minted token decodes to sub=operatorId and is signed with PLATFORM_CONTROL_SECRET', async () => {
    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const token = client.mintServiceToken(OPERATOR_ID)

    // Verify the token with the correct secret — must succeed
    const verifier = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const payload = await verifier.verifyAsync(token)

    expect(payload.sub).toBe(OPERATOR_ID)
    expect(payload.iss).toBe('viewpro-api')
    expect(payload.aud).toBe('inmoview-control')
    expect(typeof payload.jti).toBe('string')
    expect(typeof payload.exp).toBe('number')
    // exp should be approximately now+120s
    const nowSec = Math.floor(Date.now() / 1000)
    expect(payload.exp).toBeGreaterThanOrEqual(nowSec + 100)
    expect(payload.exp).toBeLessThanOrEqual(nowSec + 140)
  })

  it('minted token fails verification with ACCESS_TOKEN_SECRET (distinct secret)', async () => {
    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const token = client.mintServiceToken(OPERATOR_ID)

    // Attempt to verify with a DIFFERENT secret — must throw
    const wrongVerifier = new JwtService({ secret: ACCESS_TOKEN_SECRET })
    await expect(wrongVerifier.verifyAsync(token)).rejects.toThrow()
  })

  it('postTenantStatus calls InmoView with Authorization Bearer header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'updated' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.postTenantStatus(
      'tenant-1',
      { targetStatus: 'SUSPENDED' as const },
      'idem-key-1',
      OPERATOR_ID,
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/internal/platform/tenants/tenant-1/status')
    const authHeader = (init.headers as Record<string, string>)['Authorization']
    expect(authHeader).toMatch(/^Bearer /)

    vi.unstubAllGlobals()
  })

  // FIX 4: downstream 404 → throws HttpException with status 404
  it('postTenantStatus downstream 404 → throws HttpException with status 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not Found', statusCode: 404 }), { status: 404 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const error = await client
      .postTenantStatus('unknown-tenant', { targetStatus: 'ACTIVE' as const }, 'idem-key-2', OPERATOR_ID)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(404)

    vi.unstubAllGlobals()
  })

  // FIX 4: downstream 400 → throws HttpException with status 400
  it('postTenantStatus downstream 400 → throws HttpException with status 400', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad Request', statusCode: 400 }), { status: 400 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const error = await client
      .postTenantStatus('tenant-1', { targetStatus: 'ACTIVE' as const }, 'idem-key-400', OPERATOR_ID)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(400)

    vi.unstubAllGlobals()
  })

  // FIX 4: 2xx response still resolves successfully (passthrough unchanged)
  it('postTenantStatus 2xx → resolves with parsed body (passthrough unchanged)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'updated' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    const result = await client.postTenantStatus(
      'tenant-ok',
      { targetStatus: 'ACTIVE' as const },
      'idem-key-ok',
      OPERATOR_ID,
    )
    expect(result).toEqual({ status: 'updated' })

    vi.unstubAllGlobals()
  })

  it('postTenantLimits calls InmoView limits endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'updated' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new PlatformControlClient({
      inmoviewApiInternalUrl: 'http://localhost:3001',
      platformControlSecret: PLATFORM_CONTROL_SECRET,
    })

    await client.postTenantLimits(
      'tenant-1',
      { maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      'idem-key-3',
      OPERATOR_ID,
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/internal/platform/tenants/tenant-1/limits')

    vi.unstubAllGlobals()
  })
})

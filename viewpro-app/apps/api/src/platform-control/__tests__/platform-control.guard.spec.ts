import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Spec: PlatformControlGuard — Service Token Verification + Trust Path Isolation
// Scenarios:
//   - Missing token → 401; request.user not set; request.platformCaller not set
//   - Expired token → 401
//   - Wrong secret → 401
//   - Wrong aud → 401 (token lacking aud=inmoview-control)
//   - Valid token → passes; request.platformCaller set; request.user NOT set
//   - Token confusion: user JWT (no aud) sent to guard → 401
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = 'test-platform-control-secret-min16'
const OTHER_SECRET = 'other-secret-totally-different'
const USER_ACCESS_SECRET = 'test-access-token-secret'

const signer = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
const userSigner = new JwtService({ secret: USER_ACCESS_SECRET })
const wrongSecretSigner = new JwtService({ secret: OTHER_SECRET })

async function makeServiceToken(overrides: Record<string, unknown> = {}, overrideSecret?: string): Promise<string> {
  const base = { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-1', jti: 'token-id-1' }
  const payload = { ...base, ...overrides }
  const service = overrideSecret ? new JwtService({ secret: overrideSecret }) : signer
  return service.signAsync(payload, { expiresIn: '120s' })
}

async function makeExpiredServiceToken(): Promise<string> {
  // exp in the past (200s ago) — well outside the 30s clock skew window
  const exp = Math.floor(Date.now() / 1000) - 200
  return signer.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-1', jti: 'token-id-1', exp },
    { noTimestamp: true },
  )
}

async function makeUserToken(): Promise<string> {
  // User JWTs: sub + email, NO aud=inmoview-control
  return userSigner.signAsync({ sub: 'user-123', email: 'user@example.com' }, { expiresIn: '900s' })
}

function makeContext(authHeader?: string): { ctx: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
    cookies: {},
  }
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext
  return { ctx, request }
}

describe('PlatformControlGuard', () => {
  // biome-ignore lint/suspicious/noExplicitAny: guard loaded dynamically
  let Guard: any

  beforeEach(async () => {
    process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET
    vi.resetModules()
    const mod = await import('../platform-control.guard.js')
    Guard = mod.PlatformControlGuard
  })

  it('throws 401 when Authorization header is missing', async () => {
    const guard = new Guard()
    const { ctx, request } = makeContext(undefined)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    expect(request.platformCaller).toBeUndefined()
    expect(request.user).toBeUndefined()
  })

  it('throws 401 for an expired token', async () => {
    const expiredToken = await makeExpiredServiceToken()
    const guard = new Guard()
    const { ctx } = makeContext(`Bearer ${expiredToken}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws 401 for a token signed with the wrong secret', async () => {
    const wrongSecretToken = await makeServiceToken({}, OTHER_SECRET)
    const guard = new Guard()
    const { ctx } = makeContext(`Bearer ${wrongSecretToken}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws 401 for a token with wrong aud (not inmoview-control)', async () => {
    const wrongAudToken = await makeServiceToken({ aud: 'some-other-audience' })
    const guard = new Guard()
    const { ctx } = makeContext(`Bearer ${wrongAudToken}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws 401 for a token with missing aud claim', async () => {
    // Sign with correct secret but no aud
    const noAudToken = await new JwtService({ secret: PLATFORM_CONTROL_SECRET }).signAsync(
      { iss: 'viewpro-api', sub: 'op-1', jti: 'token-id-1' },
      { expiresIn: '120s' },
    )
    const guard = new Guard()
    const { ctx } = makeContext(`Bearer ${noAudToken}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws 401 for a user JWT (no aud=inmoview-control) — token confusion', async () => {
    const userToken = await makeUserToken()
    const guard = new Guard()
    const { ctx, request } = makeContext(`Bearer ${userToken}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    expect(request.platformCaller).toBeUndefined()
  })

  it('allows a valid service token and sets platformCaller, never sets user', async () => {
    const validToken = await makeServiceToken()
    const guard = new Guard()
    const { ctx, request } = makeContext(`Bearer ${validToken}`)

    const result = await guard.canActivate(ctx)

    expect(result).toBe(true)
    expect(request.platformCaller).toEqual({
      kind: 'service',
      callerId: 'op-1',
      tokenId: 'token-id-1',
    })
    expect(request.user).toBeUndefined()
  })

  // FIX 2: algorithm pinning — token signed with HS512 (same secret) must be rejected
  it('throws 401 for a token signed with HS512 (algorithm not in allow-list)', async () => {
    // Sign with the correct secret but using HS512 instead of HS256
    const hs512Signer = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
    const hs512Token = await hs512Signer.signAsync(
      { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-1', jti: 'token-id-hs512' },
      { expiresIn: '120s', algorithm: 'HS512' },
    )

    const guard = new Guard()
    const { ctx } = makeContext(`Bearer ${hs512Token}`)

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })
})

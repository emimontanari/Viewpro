import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { AuthGuard } from '../auth.guard'
import type { TokenService } from '../../tokens/token.service'

/**
 * T-13 — RED: AuthGuard failure paths clear BOTH cookies before throwing 401
 * (D9, AC7).
 */

function makeContext(cookies: Record<string, string | undefined>) {
  const request = { cookies, user: undefined }
  const response = { clearCookie: vi.fn() }

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext

  return { context, response }
}

function makeGuard(options: {
  verifyAccessToken?: ReturnType<typeof vi.fn>
  reissueAccessToken?: ReturnType<typeof vi.fn>
  setAccessCookie?: ReturnType<typeof vi.fn>
}) {
  const tokenService = {
    verifyAccessToken: options.verifyAccessToken ?? vi.fn(),
    reissueAccessToken: options.reissueAccessToken ?? vi.fn().mockResolvedValue('fresh.token'),
    setAccessCookie: options.setAccessCookie ?? vi.fn(),
    clearAccessCookie: vi.fn((response: { clearCookie: (...args: unknown[]) => void }) => {
      response.clearCookie('viewpro_platform_access_token', { httpOnly: true })
    }),
    clearStepUpCookie: vi.fn((response: { clearCookie: (...args: unknown[]) => void }) => {
      response.clearCookie('viewpro_platform_stepup_token', { httpOnly: true })
    }),
  }
  const configService = { get: vi.fn().mockReturnValue(600) }

  return {
    guard: new AuthGuard(
      tokenService as unknown as TokenService,
      configService as unknown as ConfigService,
    ),
    tokenService,
    configService,
  }
}

describe('AuthGuard — failure paths clear both cookies (D9, AC7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Cross-service contract (JD hardening): every AuthGuard reject must carry a
  // stable, machine-readable `code: 'AUTH_REQUIRED'` in its 401 body so the FE
  // can distinguish a session-expiry 401 from a wrong-password 401 WITHOUT
  // string-matching the human message. Pinning it here fails a backend test on
  // any future message/shape change instead of silently regressing the FE.
  async function expectAuthRequired401(promise: Promise<unknown>) {
    await expect(promise).rejects.toThrow(UnauthorizedException)
    const error = (await promise.catch((thrown: unknown) => thrown)) as UnauthorizedException
    expect(error.getResponse()).toMatchObject({
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    })
  }

  it('missing access token: clears both cookies via getResponse(), then throws UnauthorizedException', async () => {
    const { guard, tokenService } = makeGuard({})
    const { context, response } = makeContext({})

    await expectAuthRequired401(guard.canActivate(context))

    expect(tokenService.clearAccessCookie).toHaveBeenCalledWith(response)
    expect(tokenService.clearStepUpCookie).toHaveBeenCalledWith(response)
    expect(response.clearCookie).toHaveBeenCalledTimes(2)
  })

  it('verify throws (expired/tampered token): clears both cookies, then throws UnauthorizedException', async () => {
    const verifyAccessToken = vi.fn().mockRejectedValue(new Error('invalid'))
    const { guard, tokenService } = makeGuard({ verifyAccessToken })
    const { context, response } = makeContext({ viewpro_platform_access_token: 'tampered.token' })

    await expectAuthRequired401(guard.canActivate(context))

    expect(tokenService.clearAccessCookie).toHaveBeenCalledWith(response)
    expect(tokenService.clearStepUpCookie).toHaveBeenCalledWith(response)
    expect(response.clearCookie).toHaveBeenCalledTimes(2)
  })

  it('non-finite sessionExp (NaN): clears both cookies, then throws UnauthorizedException', async () => {
    // Defense-in-depth — a NaN sessionExp is unreachable in production (JSON
    // can't encode NaN, env validation blocks it), but the guard's invariant
    // must be self-contained: `typeof NaN === 'number'` is true, so a bare
    // typeof check would let it slip through and `now > NaN + tol` is false,
    // yielding an infinite session. Number.isFinite closes that.
    const nowSec = Math.floor(Date.now() / 1000)
    const verifyAccessToken = vi.fn().mockResolvedValue({
      sub: 'op-1',
      email: 'op@viewpro.app',
      sessionExp: NaN,
      iat: nowSec,
      exp: nowSec + 600,
    })
    const { guard, tokenService } = makeGuard({ verifyAccessToken })
    const { context, response } = makeContext({ viewpro_platform_access_token: 'nan.session.token' })

    await expectAuthRequired401(guard.canActivate(context))

    expect(tokenService.clearAccessCookie).toHaveBeenCalledWith(response)
    expect(tokenService.clearStepUpCookie).toHaveBeenCalledWith(response)
    expect(response.clearCookie).toHaveBeenCalledTimes(2)
  })

  it('past absolute deadline (sessionExp already elapsed): clears both cookies, then throws 401 AUTH_REQUIRED', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const verifyAccessToken = vi.fn().mockResolvedValue({
      sub: 'op-1',
      email: 'op@viewpro.app',
      sessionExp: nowSec - 3600, // absolute deadline already elapsed
      iat: nowSec - 10,
      exp: nowSec + 600, // sliding exp still valid
    })
    const { guard, tokenService } = makeGuard({ verifyAccessToken })
    const { context, response } = makeContext({ viewpro_platform_access_token: 'absolute.expired.token' })

    await expectAuthRequired401(guard.canActivate(context))

    expect(tokenService.clearAccessCookie).toHaveBeenCalledWith(response)
    expect(tokenService.clearStepUpCookie).toHaveBeenCalledWith(response)
    expect(response.clearCookie).toHaveBeenCalledTimes(2)
  })

  it('valid token: does not clear any cookie and returns true', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const verifyAccessToken = vi.fn().mockResolvedValue({
      sub: 'op-1',
      email: 'op@viewpro.app',
      sessionExp: nowSec + 28800,
      iat: nowSec,
      exp: nowSec + 600,
    })
    const { guard, tokenService } = makeGuard({ verifyAccessToken })
    const { context, response } = makeContext({ viewpro_platform_access_token: 'valid.token' })

    const result = await guard.canActivate(context)

    expect(result).toBe(true)
    expect(tokenService.clearAccessCookie).not.toHaveBeenCalled()
    expect(tokenService.clearStepUpCookie).not.toHaveBeenCalled()
    expect(response.clearCookie).not.toHaveBeenCalled()
  })
})

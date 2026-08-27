import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JwtService } from '@nestjs/jwt'
import { TokenService } from '../token.service'
import { ACCESS_TOKEN_COOKIE, STEP_UP_TOKEN_COOKIE } from '../../auth.constants'

const SECRET_A = 'platform-secret-a'
const SECRET_B = 'inmoview-secret-b'
const STEP_UP_SECRET = 'platform-step-up-secret'

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'app.auth.idleTimeoutSeconds': 600,
    'app.auth.absoluteSessionSeconds': 28800,
    'app.auth.stepUpTokenSecret': STEP_UP_SECRET,
    'app.auth.stepUpTtlSeconds': 300,
    'app.cookies.domain': undefined,
    'app.cookies.secure': false,
  }
  const config = { ...defaults, ...overrides }
  return {
    get: (key: string, fallback?: unknown) => config[key] ?? fallback,
  }
}

function makeTokenService(secret = SECRET_A, configOverrides: Record<string, unknown> = {}) {
  const jwtService = new JwtService({ secret, signOptions: { expiresIn: 900 } })
  return new TokenService(jwtService, makeConfigService(configOverrides) as never)
}

describe('TokenService — cookie name and security attributes', () => {
  let tokenService: TokenService
  let mockResponse: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    tokenService = makeTokenService()
    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    }
  })

  it('setAccessCookie uses exactly the ACCESS_TOKEN_COOKIE constant as cookie name', () => {
    tokenService.setAccessCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const cookieName = firstCall[0]
    expect(cookieName).toBe(ACCESS_TOKEN_COOKIE)
    expect(cookieName).toBe('viewpro_platform_access_token')
  })

  it('setAccessCookie never uses the InmoView cookie name viewpro_access_token', () => {
    tokenService.setAccessCookie(mockResponse as never, 'some-token')

    for (const call of mockResponse.cookie.mock.calls) {
      expect(call[0]).not.toBe('viewpro_access_token')
    }
  })

  it('setAccessCookie sets httpOnly: true', () => {
    tokenService.setAccessCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const options = firstCall[2] as { httpOnly: boolean; sameSite: string }
    expect(options.httpOnly).toBe(true)
  })

  it('setAccessCookie sets sameSite: lax', () => {
    tokenService.setAccessCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const options = firstCall[2] as { httpOnly: boolean; sameSite: string }
    expect(options.sameSite).toBe('lax')
  })

  it('signAccessToken returns a decodable JWT with sub and email claims', async () => {
    const token = await tokenService.signAccessToken({ sub: 'op-123', email: 'op@viewpro.app' })

    expect(typeof token).toBe('string')
    // Decode the JWT payload without verification (3 base64 parts separated by dots)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
    expect(payload.sub).toBe('op-123')
    expect(payload.email).toBe('op@viewpro.app')
  })

  it('token signed with SECRET_A cannot be verified with SECRET_B', async () => {
    const serviceA = makeTokenService(SECRET_A)
    const serviceB = makeTokenService(SECRET_B)
    const token = await serviceA.signAccessToken({ sub: 'op-999', email: 'x@y.com' })

    // serviceB has a different secret; verifyAccessToken should throw
    await expect(serviceB.verifyAccessToken(token)).rejects.toThrow('invalid signature')
  })
})

describe('TokenService — sessionExp mint/reissue/clockTolerance (D1/D3/D4/D6)', () => {
  let tokenService: TokenService
  let mockResponse: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    tokenService = makeTokenService()
    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    }
  })

  function decode(token: string): Record<string, unknown> {
    const parts = token.split('.')
    return JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
  }

  it('signAccessToken mints sessionExp ~= now + absoluteSessionSeconds and exp ~= now + idleTimeoutSeconds (not 900)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const token = await tokenService.signAccessToken({ sub: 'op-1', email: 'op@viewpro.app' })

    const payload = decode(token)
    expect(payload.sessionExp).toBeGreaterThanOrEqual(nowSec + 28800 - 2)
    expect(payload.sessionExp).toBeLessThanOrEqual(nowSec + 28800 + 2)
    expect(payload.exp).toBeGreaterThanOrEqual(nowSec + 600 - 2)
    expect(payload.exp).toBeLessThanOrEqual(nowSec + 600 + 2)
    expect(payload.exp).not.toBeGreaterThanOrEqual(nowSec + 900 - 2)
  })

  it('reissueAccessToken returns a fresh token with the SAME sessionExp and NEW iat/exp, without throwing on an already-signed payload', async () => {
    const signed = await tokenService.signAccessToken({ sub: 'op-1', email: 'op@viewpro.app' })
    const verified = await tokenService.verifyAccessToken(signed)

    await new Promise((resolve) => setTimeout(resolve, 1100))

    const reissued = await tokenService.reissueAccessToken(verified)
    const reissuedPayload = decode(reissued)

    expect(reissuedPayload.sessionExp).toBe(verified.sessionExp)
    expect(reissuedPayload.iat).not.toBe(verified.iat)
    expect(reissuedPayload.sub).toBe('op-1')
    expect(reissuedPayload.email).toBe('op@viewpro.app')
  })

  it('setAccessCookie maxAge = idleTimeoutSeconds * 1000 (600000, not 900000)', () => {
    tokenService.setAccessCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const options = firstCall[2] as { maxAge: number }
    expect(options.maxAge).toBe(600 * 1000)
  })

  it('verifyAccessToken resolves a token whose exp is 3s in the past (clockTolerance forwarded)', async () => {
    const jwtService = new JwtService({ secret: SECRET_A })
    const almostExpired = await jwtService.signAsync(
      { sub: 'op-1', email: 'op@viewpro.app', sessionExp: Math.floor(Date.now() / 1000) + 28800 },
      { expiresIn: -3 },
    )

    await expect(tokenService.verifyAccessToken(almostExpired)).resolves.toMatchObject({
      sub: 'op-1',
    })
  })
})

describe('TokenService — step-up sign/verify/cookie (D1-D3)', () => {
  let tokenService: TokenService
  let mockResponse: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    tokenService = makeTokenService()
    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    }
  })

  it('signStepUpToken returns a JWT with stepUp:true and sub claims', async () => {
    const token = await tokenService.signStepUpToken({ sub: 'op-123' })

    expect(typeof token).toBe('string')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
    expect(payload.sub).toBe('op-123')
    expect(payload.stepUp).toBe(true)
  })

  it('verifyStepUpToken resolves a token signed with the step-up secret', async () => {
    const token = await tokenService.signStepUpToken({ sub: 'op-123' })

    const payload = await tokenService.verifyStepUpToken(token)

    expect(payload.sub).toBe('op-123')
    expect(payload.stepUp).toBe(true)
  })

  it('a step-up token (STEP_UP_TOKEN_SECRET) fails verifyAccessToken (cross-verify direction 1)', async () => {
    const stepUpToken = await tokenService.signStepUpToken({ sub: 'op-123' })

    await expect(tokenService.verifyAccessToken(stepUpToken)).rejects.toThrow('invalid signature')
  })

  it('an access token (ACCESS_TOKEN_SECRET) fails verifyStepUpToken (cross-verify direction 2)', async () => {
    const accessToken = await tokenService.signAccessToken({ sub: 'op-123', email: 'op@viewpro.app' })

    await expect(tokenService.verifyStepUpToken(accessToken)).rejects.toThrow('invalid signature')
  })

  it('setStepUpCookie uses exactly the STEP_UP_TOKEN_COOKIE constant as cookie name', () => {
    tokenService.setStepUpCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    expect(firstCall[0]).toBe(STEP_UP_TOKEN_COOKIE)
    expect(firstCall[0]).toBe('viewpro_platform_stepup_token')
  })

  it('setStepUpCookie sets httpOnly: true and sameSite: lax', () => {
    tokenService.setStepUpCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const options = firstCall[2] as { httpOnly: boolean; sameSite: string }
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
  })

  it('setStepUpCookie sets maxAge = STEP_UP_TTL_SECONDS * 1000', () => {
    tokenService.setStepUpCookie(mockResponse as never, 'some-token')

    const firstCall = mockResponse.cookie.mock.calls[0] ?? []
    const options = firstCall[2] as { maxAge: number }
    expect(options.maxAge).toBe(300 * 1000)
  })

  it('clearStepUpCookie calls clearCookie with STEP_UP_TOKEN_COOKIE and base cookie options', () => {
    tokenService.clearStepUpCookie(mockResponse as never)

    const firstCall = mockResponse.clearCookie.mock.calls[0] ?? []
    expect(firstCall[0]).toBe(STEP_UP_TOKEN_COOKIE)
    const options = firstCall[1] as { httpOnly: boolean; sameSite: string }
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
  })
})

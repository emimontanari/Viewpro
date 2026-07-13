import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JwtService } from '@nestjs/jwt'
import { TokenService } from '../token.service'
import { ACCESS_TOKEN_COOKIE } from '../../auth.constants'

const SECRET_A = 'platform-secret-a'
const SECRET_B = 'inmoview-secret-b'

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'app.auth.accessTokenTtlSeconds': 900,
    'app.cookies.domain': undefined,
    'app.cookies.secure': false,
  }
  const config = { ...defaults, ...overrides }
  return {
    get: (key: string, fallback?: unknown) => config[key] ?? fallback,
  }
}

function makeTokenService(secret = SECRET_A) {
  const jwtService = new JwtService({ secret, signOptions: { expiresIn: 900 } })
  return new TokenService(jwtService, makeConfigService() as never)
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
    await expect(serviceB.verifyAccessToken(token)).rejects.toThrow()
  })
})

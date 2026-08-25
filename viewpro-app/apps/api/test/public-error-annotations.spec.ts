import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArgumentsHost, ExecutionContext } from '@nestjs/common'
import { HttpException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { AuthGuard } from '../src/auth/guards/auth.guard'
import { GetCurrentUserUseCase } from '../src/auth/use-cases/get-current-user.use-case'
import { RefreshSessionUseCase } from '../src/auth/use-cases/refresh-session.use-case'
import { ResetPasswordUseCase } from '../src/auth/use-cases/reset-password.use-case'
import { VerifyEmailUseCase } from '../src/auth/use-cases/verify-email.use-case'
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Hermetic production-mode boundary (ADR-2): the filter is constructed
 * directly with nodeEnv = 'production' so `sanitizeProductionMessage`
 * activates without mutating `process.env.NODE_ENV` for the whole worker.
 */
function catchThroughProductionFilter(exception: unknown) {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, setHeader: vi.fn() }),
      getRequest: () => ({ url: '/api/boundary-test', requestId: 'boundary-request-id' }),
    }),
  } as ArgumentsHost

  new GlobalExceptionFilter('production', undefined, {}).catch(exception, host)

  return json.mock.calls[0]?.[0]
}

async function throwFrom(operation: () => Promise<unknown> | unknown): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    return error
  }

  throw new Error('expected operation to throw')
}

function readSource(relativePath: string) {
  return readFileSync(join(apiRoot, 'src', relativePath), 'utf8')
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length
}

describe('Public error annotations — production emission boundary (WU-A)', () => {
  it('AuthGuard rejects a missing session cookie as SESSION_EXPIRED', async () => {
    const guard = new AuthGuard({ verifyAccessToken: vi.fn() } as never)
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: {} }) }),
    } as unknown as ExecutionContext

    const thrown = await throwFrom(() => guard.canActivate(context))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('GetCurrentUserUseCase rejects an inactive or missing user as SESSION_EXPIRED', async () => {
    const useCase = new GetCurrentUserUseCase(
      { findById: vi.fn().mockResolvedValue(null) } as never,
      { findActiveManyByUserId: vi.fn() } as never,
    )

    const thrown = await throwFrom(() => useCase.execute('user-1'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('RefreshSessionUseCase rejects a missing refresh token as SESSION_EXPIRED', async () => {
    const useCase = new RefreshSessionUseCase(
      { findByTokenHash: vi.fn() } as never,
      { hashRefreshToken: vi.fn() } as never,
      { execute: vi.fn() } as never,
    )

    const thrown = await throwFrom(() => useCase.execute(undefined))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('VerifyEmailUseCase rejects an invalid or expired token as AUTH_TOKEN_INVALID', async () => {
    const useCase = new VerifyEmailUseCase(
      { findByTokenHash: vi.fn().mockResolvedValue(null) } as never,
      { markEmailVerified: vi.fn() } as never,
      { hashEmailVerificationToken: vi.fn().mockReturnValue('hashed-token') } as never,
    )

    const thrown = await throwFrom(() => useCase.execute({ token: 'invalid-token' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid request payload',
    })
  })

  it('ResetPasswordUseCase rejects an invalid or expired token as AUTH_TOKEN_INVALID', async () => {
    const useCase = new ResetPasswordUseCase(
      { findByTokenHash: vi.fn().mockResolvedValue(null) } as never,
      { updatePassword: vi.fn() } as never,
      { hash: vi.fn() } as never,
      { revokeAllForUser: vi.fn() } as never,
      { hashPasswordResetToken: vi.fn().mockReturnValue('hashed-token') } as never,
    )

    const thrown = await throwFrom(() => useCase.execute({ token: 'invalid-token', password: 'new-Password1!' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid request payload',
    })
  })
})

describe('Public error annotations — per-file exhaustiveness guard (WU-A)', () => {
  it('auth.guard.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/guards/auth.guard.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('get-current-user.use-case.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/get-current-user.use-case.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('refresh-session.use-case.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/refresh-session.use-case.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  // BadRequestException is deliberately excluded from the shared exhaustiveness pattern
  // (design.md ADR-2) because other in-scope files carry unrelated DTO-validation throws
  // that must stay unannotated. verify-email.use-case.ts and reset-password.use-case.ts
  // carry no other BadRequestException, so the file-scoped count is exact here.
  it('verify-email.use-case.ts annotates its BadRequestException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/verify-email.use-case.ts')

    expect(countMatches(source, /throw new BadRequestException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('reset-password.use-case.ts annotates its BadRequestException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/reset-password.use-case.ts')

    expect(countMatches(source, /throw new BadRequestException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('excludes login.use-case.ts and register-tenant.use-case.ts from the guard scope (enumeration protection)', () => {
    const loginSource = readSource('auth/use-cases/login.use-case.ts')
    const registerTenantSource = readSource('auth/use-cases/register-tenant.use-case.ts')

    expect(countMatches(loginSource, /errorCode:/g)).toBe(0)
    expect(countMatches(registerTenantSource, /errorCode:/g)).toBe(0)
  })
})

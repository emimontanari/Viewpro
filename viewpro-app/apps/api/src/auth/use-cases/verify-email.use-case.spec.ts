import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { VerifyEmailUseCase } from './verify-email.use-case'

function buildTokenService() {
  return {
    hashEmailVerificationToken: vi.fn().mockReturnValue('hashed-token'),
  }
}

function buildVerificationToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'verify-1',
    userId: 'user-1',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 86_400_000),
    usedAt: null,
    createdAt: new Date(),
    user: { id: 'user-1', email: 'jane@example.com' },
    ...overrides,
  }
}

function buildDeps(verificationToken: unknown) {
  const emailVerificationTokenRepository = {
    findByTokenHash: vi.fn().mockResolvedValue(verificationToken),
    markUsed: vi.fn().mockResolvedValue(undefined),
  }
  const usersRepository = { markEmailVerified: vi.fn().mockResolvedValue(undefined) }
  const useCase = new VerifyEmailUseCase(
    emailVerificationTokenRepository as never,
    usersRepository as never,
    buildTokenService() as never,
  )
  return { useCase, emailVerificationTokenRepository, usersRepository }
}

describe('VerifyEmailUseCase', () => {
  it('marks the user verified and consumes the token for a valid token', async () => {
    const deps = buildDeps(buildVerificationToken())

    await deps.useCase.execute({ token: 'raw-token' })

    expect(deps.usersRepository.markEmailVerified).toHaveBeenCalledWith('user-1')
    expect(deps.emailVerificationTokenRepository.markUsed).toHaveBeenCalledWith('verify-1')
  })

  it('rejects an already-used token', async () => {
    const deps = buildDeps(buildVerificationToken({ usedAt: new Date() }))

    await expect(deps.useCase.execute({ token: 'raw-token' })).rejects.toThrow(BadRequestException)
    expect(deps.usersRepository.markEmailVerified).not.toHaveBeenCalled()
    expect(deps.emailVerificationTokenRepository.markUsed).not.toHaveBeenCalled()
  })

  it('rejects an expired token', async () => {
    const deps = buildDeps(buildVerificationToken({ expiresAt: new Date(Date.now() - 1000) }))

    await expect(deps.useCase.execute({ token: 'raw-token' })).rejects.toThrow(BadRequestException)
    expect(deps.usersRepository.markEmailVerified).not.toHaveBeenCalled()
  })

  it('rejects a non-existent token', async () => {
    const deps = buildDeps(null)

    await expect(deps.useCase.execute({ token: 'raw-token' })).rejects.toThrow(BadRequestException)
    expect(deps.usersRepository.markEmailVerified).not.toHaveBeenCalled()
  })
})

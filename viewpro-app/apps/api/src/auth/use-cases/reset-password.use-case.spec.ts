import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ResetPasswordUseCase } from './reset-password.use-case'

function buildTokenService() {
  return {
    hashPasswordResetToken: vi.fn().mockReturnValue('hashed-token'),
  }
}

function buildResetToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reset-1',
    userId: 'user-1',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 3600_000),
    usedAt: null,
    createdAt: new Date(),
    user: { id: 'user-1', email: 'jane@example.com' },
    ...overrides,
  }
}

function buildDeps(resetToken: unknown) {
  const passwordResetTokenRepository = {
    findByTokenHash: vi.fn().mockResolvedValue(resetToken),
    markUsed: vi.fn().mockResolvedValue(undefined),
  }
  const usersRepository = { updatePassword: vi.fn().mockResolvedValue(undefined) }
  const passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash') }
  const refreshTokenRepository = { revokeAllForUser: vi.fn().mockResolvedValue(undefined) }
  const useCase = new ResetPasswordUseCase(
    passwordResetTokenRepository as never,
    usersRepository as never,
    passwordHasher as never,
    refreshTokenRepository as never,
    buildTokenService() as never,
  )
  return { useCase, passwordResetTokenRepository, usersRepository, passwordHasher, refreshTokenRepository }
}

describe('ResetPasswordUseCase', () => {
  it('updates the password, marks the token used, and revokes all refresh tokens for a valid token', async () => {
    const deps = buildDeps(buildResetToken())

    await deps.useCase.execute({ token: 'raw-token', password: 'new-password' })

    expect(deps.passwordHasher.hash).toHaveBeenCalledWith('new-password')
    expect(deps.usersRepository.updatePassword).toHaveBeenCalledWith('user-1', 'new-hash')
    expect(deps.passwordResetTokenRepository.markUsed).toHaveBeenCalledWith('reset-1')
    expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-1')
  })

  it('rejects an already-used token', async () => {
    const deps = buildDeps(buildResetToken({ usedAt: new Date() }))

    await expect(deps.useCase.execute({ token: 'raw-token', password: 'new-password' })).rejects.toThrow(
      BadRequestException,
    )
    expect(deps.usersRepository.updatePassword).not.toHaveBeenCalled()
    expect(deps.refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled()
  })

  it('rejects an expired token', async () => {
    const deps = buildDeps(buildResetToken({ expiresAt: new Date(Date.now() - 1000) }))

    await expect(deps.useCase.execute({ token: 'raw-token', password: 'new-password' })).rejects.toThrow(
      BadRequestException,
    )
    expect(deps.usersRepository.updatePassword).not.toHaveBeenCalled()
  })

  it('rejects a non-existent token', async () => {
    const deps = buildDeps(null)

    await expect(deps.useCase.execute({ token: 'raw-token', password: 'new-password' })).rejects.toThrow(
      BadRequestException,
    )
    expect(deps.usersRepository.updatePassword).not.toHaveBeenCalled()
  })
})

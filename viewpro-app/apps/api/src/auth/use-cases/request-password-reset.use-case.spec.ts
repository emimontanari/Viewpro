import { UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { RequestPasswordResetUseCase } from './request-password-reset.use-case'

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'old-hash',
    status: UserStatus.ACTIVE,
    ...overrides,
  }
}

function buildTokenService() {
  return {
    generatePasswordResetToken: vi.fn().mockReturnValue('raw-token'),
    hashPasswordResetToken: vi.fn().mockReturnValue('hashed-token'),
    getPasswordResetExpiresAt: vi.fn().mockReturnValue(new Date('2026-07-20T01:00:00.000Z')),
  }
}

function buildConfig() {
  return {
    getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app'),
  }
}

describe('RequestPasswordResetUseCase', () => {
  it('resolves without creating a token or sending email when the account does not exist (no enumeration)', async () => {
    const usersRepository = { findByEmail: vi.fn().mockResolvedValue(null) }
    const passwordResetTokenRepository = {
      deleteAllForUser: vi.fn(),
      create: vi.fn(),
    }
    const emailSender = { sendPasswordReset: vi.fn() }
    const useCase = new RequestPasswordResetUseCase(
      usersRepository as never,
      passwordResetTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await expect(useCase.execute({ email: 'ghost@example.com' })).resolves.toBeUndefined()

    expect(passwordResetTokenRepository.create).not.toHaveBeenCalled()
    expect(emailSender.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('does not create a token or send email when the account is not active', async () => {
    const usersRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser({ status: UserStatus.SUSPENDED })),
    }
    const passwordResetTokenRepository = { deleteAllForUser: vi.fn(), create: vi.fn() }
    const emailSender = { sendPasswordReset: vi.fn() }
    const useCase = new RequestPasswordResetUseCase(
      usersRepository as never,
      passwordResetTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await useCase.execute({ email: 'jane@example.com' })

    expect(passwordResetTokenRepository.create).not.toHaveBeenCalled()
    expect(emailSender.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('creates a hashed token and sends the reset email for an active account', async () => {
    const usersRepository = { findByEmail: vi.fn().mockResolvedValue(buildUser()) }
    const passwordResetTokenRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    }
    const emailSender = { sendPasswordReset: vi.fn().mockResolvedValue(undefined) }
    const useCase = new RequestPasswordResetUseCase(
      usersRepository as never,
      passwordResetTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await useCase.execute({ email: 'Jane@Example.com' })

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('jane@example.com')
    expect(passwordResetTokenRepository.deleteAllForUser).toHaveBeenCalledWith('user-1')
    expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tokenHash: 'hashed-token' }),
    )
    expect(emailSender.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        resetUrl: 'https://app.inmoview.app/auth/reset-password?token=raw-token',
      }),
    )
  })

  it('still resolves when the email sender throws (best-effort delivery)', async () => {
    const usersRepository = { findByEmail: vi.fn().mockResolvedValue(buildUser()) }
    const passwordResetTokenRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    }
    const emailSender = {
      sendPasswordReset: vi.fn().mockRejectedValue(new Error('resend down')),
    }
    const useCase = new RequestPasswordResetUseCase(
      usersRepository as never,
      passwordResetTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await expect(useCase.execute({ email: 'jane@example.com' })).resolves.toBeUndefined()
    expect(passwordResetTokenRepository.create).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { ResendEmailVerificationUseCase } from './resend-email-verification.use-case'

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    emailVerifiedAt: null,
    ...overrides,
  }
}

function buildTokenService() {
  return {
    generateEmailVerificationToken: vi.fn().mockReturnValue('raw-token'),
    hashEmailVerificationToken: vi.fn().mockReturnValue('hashed-token'),
    getEmailVerificationExpiresAt: vi.fn().mockReturnValue(new Date('2026-07-21T00:00:00.000Z')),
  }
}

function buildConfig() {
  return {
    getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app'),
  }
}

const currentUser = { id: 'user-1', email: 'jane@example.com' }

describe('ResendEmailVerificationUseCase', () => {
  it('is a no-op when the user is already verified (no token created, no email sent)', async () => {
    const usersRepository = {
      findById: vi.fn().mockResolvedValue(buildUser({ emailVerifiedAt: new Date() })),
    }
    const emailVerificationTokenRepository = { deleteAllForUser: vi.fn(), create: vi.fn() }
    const emailSender = { sendEmailVerification: vi.fn() }
    const useCase = new ResendEmailVerificationUseCase(
      usersRepository as never,
      emailVerificationTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await expect(useCase.execute(currentUser)).resolves.toBeUndefined()

    expect(emailVerificationTokenRepository.create).not.toHaveBeenCalled()
    expect(emailSender.sendEmailVerification).not.toHaveBeenCalled()
  })

  it('creates a hashed token and sends the verification email for an unverified user', async () => {
    const usersRepository = { findById: vi.fn().mockResolvedValue(buildUser()) }
    const emailVerificationTokenRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    }
    const emailSender = { sendEmailVerification: vi.fn().mockResolvedValue(undefined) }
    const useCase = new ResendEmailVerificationUseCase(
      usersRepository as never,
      emailVerificationTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await useCase.execute(currentUser)

    expect(emailVerificationTokenRepository.deleteAllForUser).toHaveBeenCalledWith('user-1')
    expect(emailVerificationTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tokenHash: 'hashed-token' }),
    )
    expect(emailSender.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        verificationUrl: 'https://app.inmoview.app/auth/verify-email?token=raw-token',
      }),
    )
  })

  it('still resolves when the email sender throws (best-effort delivery)', async () => {
    const usersRepository = { findById: vi.fn().mockResolvedValue(buildUser()) }
    const emailVerificationTokenRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    }
    const emailSender = {
      sendEmailVerification: vi.fn().mockRejectedValue(new Error('resend down')),
    }
    const useCase = new ResendEmailVerificationUseCase(
      usersRepository as never,
      emailVerificationTokenRepository as never,
      emailSender as never,
      buildTokenService() as never,
      buildConfig() as never,
    )

    await expect(useCase.execute(currentUser)).resolves.toBeUndefined()
    expect(emailVerificationTokenRepository.create).toHaveBeenCalledTimes(1)
  })
})

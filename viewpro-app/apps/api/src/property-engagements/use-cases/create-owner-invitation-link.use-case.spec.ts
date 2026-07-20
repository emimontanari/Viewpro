import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import type { EmailSender } from '../../email/email-sender.port'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { CreateOwnerInvitationLinkUseCase } from './create-owner-invitation-link.use-case'

const currentUser = { id: 'user-1' } as CurrentUser

function buildTenant(): TenantContext {
  return {
    tenantId: 'tenant-1',
    permissions: [PERMISSIONS.ENGAGEMENTS_CREATE, PERMISSIONS.ENGAGEMENTS_VIEW_ALL],
  } as unknown as TenantContext
}

function buildConfig() {
  return { getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app') } as unknown as ConfigService
}

function buildRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByIdForTenant: vi.fn().mockResolvedValue({ propertyAssetId: 'asset-1' }),
    createOwnerInvitationLink: vi.fn().mockResolvedValue({
      status: 'created',
      invitation: {
        id: 'own-inv-1',
        propertyAssetOwnerId: 'pao-1',
        email: 'owner@example.com',
        token: 'own-tok-1',
        expiresAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    }),
    ...overrides,
  }
}

describe('CreateOwnerInvitationLinkUseCase email', () => {
  it('sends the owner invitation email with the correct recipient and url', async () => {
    const repo = buildRepo()
    const emailSender: EmailSender = {
      sendTeamInvitation: vi.fn(),
      sendOwnerInvitation: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn(),
    }
    const useCase = new CreateOwnerInvitationLinkUseCase(repo as never, buildConfig(), emailSender)

    const response = await useCase.execute(buildTenant(), currentUser, 'eng-1', 'owner-1')

    expect(emailSender.sendOwnerInvitation).toHaveBeenCalledTimes(1)
    expect(emailSender.sendOwnerInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        invitationUrl: 'https://app.inmoview.app/owner-invitations/own-tok-1',
      }),
    )
    expect(response.invitationUrl).toBe('https://app.inmoview.app/owner-invitations/own-tok-1')
  })

  it('still returns the link response when the email sender throws (best-effort)', async () => {
    const repo = buildRepo()
    const emailSender: EmailSender = {
      sendTeamInvitation: vi.fn(),
      sendOwnerInvitation: vi.fn().mockRejectedValue(new Error('resend down')),
      sendPasswordReset: vi.fn(),
    }
    const useCase = new CreateOwnerInvitationLinkUseCase(repo as never, buildConfig(), emailSender)

    const response = await useCase.execute(buildTenant(), currentUser, 'eng-1', 'owner-1')

    expect(response.invitationUrl).toBe('https://app.inmoview.app/owner-invitations/own-tok-1')
    expect(response.invitationId).toBe('own-inv-1')
  })
})

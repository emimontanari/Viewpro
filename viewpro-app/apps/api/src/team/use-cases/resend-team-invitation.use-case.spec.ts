import { ConfigService } from '@nestjs/config'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { EmailSender } from '../../email/email-sender.port'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { ResendTeamInvitationUseCase } from './resend-team-invitation.use-case'

const currentUser = { id: 'user-1' } as CurrentUser

function buildTenant(): TenantContext {
  return { tenantId: 'tenant-1', permissions: [PERMISSIONS.TEAM_MANAGE] } as unknown as TenantContext
}

function buildConfig() {
  return { getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app') } as unknown as ConfigService
}

describe('ResendTeamInvitationUseCase email', () => {
  it('re-sends the invitation email after resending the invitation', async () => {
    const invitation = {
      id: 'inv-1',
      email: 'manager@example.com',
      role: TenantRole.MANAGER,
      status: 'PENDING',
      token: 'tok-999',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    }
    const repo = {
      resendInvitation: vi.fn().mockResolvedValue({ status: 'resent', invitation }),
    }
    const emailSender: EmailSender = {
      sendTeamInvitation: vi.fn().mockResolvedValue(undefined),
      sendOwnerInvitation: vi.fn(),
      sendPasswordReset: vi.fn(),
      sendEmailVerification: vi.fn(),
    }
    const useCase = new ResendTeamInvitationUseCase(repo as never, buildConfig(), emailSender)

    const response = await useCase.execute(buildTenant(), currentUser, 'inv-1')

    expect(emailSender.sendTeamInvitation).toHaveBeenCalledTimes(1)
    expect(emailSender.sendTeamInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        role: 'MANAGER',
        invitationUrl: 'https://app.inmoview.app/team-invitations/tok-999',
      }),
    )
    expect(response.invitationUrl).toBe('https://app.inmoview.app/team-invitations/tok-999')
  })
})

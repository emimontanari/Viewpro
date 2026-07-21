import { ConfigService } from '@nestjs/config'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { EmailSender } from '../../email/email-sender.port'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { CreateTeamInvitationUseCase } from './create-team-invitation.use-case'

function buildInvitation() {
  return {
    id: 'inv-1',
    email: 'agent@example.com',
    role: TenantRole.AGENT,
    status: 'PENDING',
    token: 'tok-123',
    expiresAt: new Date('2026-01-15T00:00:00.000Z'),
  }
}

function buildTenant(): TenantContext {
  return {
    tenantId: 'tenant-1',
    permissions: [PERMISSIONS.TEAM_MANAGE],
  } as unknown as TenantContext
}

const currentUser = { id: 'user-1' } as CurrentUser

function buildConfig() {
  return {
    getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app'),
  } as unknown as ConfigService
}

describe('CreateTeamInvitationUseCase email', () => {
  it('sends the team invitation email with the correct recipient, role and url', async () => {
    const invitation = buildInvitation()
    const repo = {
      createPendingInvitation: vi.fn().mockResolvedValue({ status: 'created', invitation }),
    }
    const emailSender: EmailSender = {
      sendTeamInvitation: vi.fn().mockResolvedValue(undefined),
      sendOwnerInvitation: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn(),
      sendEmailVerification: vi.fn(),
      sendOwnerNotification: vi.fn(),
    }
    const useCase = new CreateTeamInvitationUseCase(repo as never, buildConfig(), emailSender)

    const response = await useCase.execute(buildTenant(), currentUser, {
      email: 'Agent@Example.com',
      role: TenantRole.AGENT,
    } as never)

    expect(emailSender.sendTeamInvitation).toHaveBeenCalledTimes(1)
    expect(emailSender.sendTeamInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'agent@example.com',
        role: 'AGENT',
        invitationUrl: 'https://app.inmoview.app/team-invitations/tok-123',
      }),
    )
    expect(response.invitationUrl).toBe('https://app.inmoview.app/team-invitations/tok-123')
  })

  it('still returns the link response when the email sender throws (best-effort)', async () => {
    const invitation = buildInvitation()
    const repo = {
      createPendingInvitation: vi.fn().mockResolvedValue({ status: 'created', invitation }),
    }
    const emailSender: EmailSender = {
      sendTeamInvitation: vi.fn().mockRejectedValue(new Error('resend down')),
      sendOwnerInvitation: vi.fn(),
      sendPasswordReset: vi.fn(),
      sendEmailVerification: vi.fn(),
      sendOwnerNotification: vi.fn(),
    }
    const useCase = new CreateTeamInvitationUseCase(repo as never, buildConfig(), emailSender)

    const response = await useCase.execute(buildTenant(), currentUser, {
      email: 'agent@example.com',
      role: TenantRole.AGENT,
    } as never)

    expect(response.invitationUrl).toBe('https://app.inmoview.app/team-invitations/tok-123')
    expect(response.invitationId).toBe('inv-1')
  })
})

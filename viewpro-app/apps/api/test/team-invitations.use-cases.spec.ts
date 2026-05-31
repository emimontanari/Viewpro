import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common'
import { TeamInvitationStatus, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../src/permissions/permissions.constants'
import { CreateTeamInvitationUseCase } from '../src/team/use-cases/create-team-invitation.use-case'
import { ResendTeamInvitationUseCase } from '../src/team/use-cases/resend-team-invitation.use-case'
import { RevokeTeamInvitationUseCase } from '../src/team/use-cases/revoke-team-invitation.use-case'
import type { TenantContext } from '../src/tenant-context/tenant-context.types'

const tenant: TenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  tenantStatus: TenantStatus.ACTIVE,
  membershipId: 'membership-1',
  role: TenantRole.PRINCIPAL_MANAGER,
  permissions: [PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MANAGE],
  userStatus: UserStatus.ACTIVE,
}

const currentUser = { id: 'user-1', email: 'principal@example.com' }
const configService = { getOrThrow: vi.fn().mockReturnValue('https://app.viewpro.test') }
const expiresAt = new Date('2026-06-14T10:00:00.000Z')

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-1',
    tenantId: 'tenant-1',
    email: 'seller@example.com',
    role: TenantRole.AGENT,
    tokenHash: 'token-hash',
    token: 'raw-token',
    status: TeamInvitationStatus.PENDING,
    expiresAt,
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: 'user-1',
    createdAt: new Date('2026-05-31T10:00:00.000Z'),
    updatedAt: new Date('2026-05-31T10:00:00.000Z'),
    ...overrides,
  }
}

describe('team invitation use cases', () => {
  it('creates a manager invitation and maps the one-time invitation URL', async () => {
    const repository = {
      createPendingInvitation: vi.fn().mockResolvedValue({
        status: 'created',
        invitation: invitation({ role: TenantRole.MANAGER, token: 'fresh token' }),
      }),
    }
    const useCase = new CreateTeamInvitationUseCase(repository as never, configService as never)

    const result = await useCase.execute(tenant, currentUser, {
      email: 'Manager@Example.com',
      role: TenantRole.MANAGER,
    })

    expect(repository.createPendingInvitation).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      email: 'manager@example.com',
      role: TenantRole.MANAGER,
      invitedByUserId: 'user-1',
    })
    expect(result).toEqual({
      invitationId: 'invitation-1',
      email: 'seller@example.com',
      role: TenantRole.MANAGER,
      status: TeamInvitationStatus.PENDING,
      expiresAt: '2026-06-14T10:00:00.000Z',
      invitationUrl: 'https://app.viewpro.test/team-invitations/fresh%20token',
    })
    expect(JSON.stringify(result)).not.toContain('tokenHash')
  })

  it('creates an agent invitation', async () => {
    const repository = {
      createPendingInvitation: vi.fn().mockResolvedValue({ status: 'created', invitation: invitation() }),
    }
    const useCase = new CreateTeamInvitationUseCase(repository as never, configService as never)

    await expect(
      useCase.execute(tenant, currentUser, { email: 'seller@example.com', role: TenantRole.AGENT }),
    ).resolves.toMatchObject({ role: TenantRole.AGENT })
  })

  it('rejects create without TEAM_MANAGE', async () => {
    const repository = { createPendingInvitation: vi.fn() }
    const useCase = new CreateTeamInvitationUseCase(repository as never, configService as never)

    await expect(
      useCase.execute({ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] }, currentUser, {
        email: 'seller@example.com',
        role: TenantRole.AGENT,
      }),
    ).rejects.toThrow(new ForbiddenException('Insufficient permissions'))
    expect(repository.createPendingInvitation).not.toHaveBeenCalled()
  })

  it('rejects unsupported principal manager invitations', async () => {
    const repository = { createPendingInvitation: vi.fn() }
    const useCase = new CreateTeamInvitationUseCase(repository as never, configService as never)

    await expect(
      useCase.execute(tenant, currentUser, {
        email: 'principal@example.com',
        role: TenantRole.PRINCIPAL_MANAGER as typeof TenantRole.AGENT,
      }),
    ).rejects.toThrow(new BadRequestException('Unsupported invitation role'))
  })

  it('maps existing membership conflicts', async () => {
    const repository = { createPendingInvitation: vi.fn().mockResolvedValue({ status: 'alreadyMember' }) }
    const useCase = new CreateTeamInvitationUseCase(repository as never, configService as never)

    await expect(
      useCase.execute(tenant, currentUser, { email: 'member@example.com', role: TenantRole.AGENT }),
    ).rejects.toThrow(new ConflictException('User is already a member of this tenant'))
  })

  it('resends an invitation and returns a fresh one-time URL', async () => {
    const repository = {
      resendInvitation: vi.fn().mockResolvedValue({
        status: 'created',
        invitation: invitation({ id: 'invitation-2', token: 'fresh-token' }),
      }),
    }
    const useCase = new ResendTeamInvitationUseCase(repository as never, configService as never)

    await expect(useCase.execute(tenant, currentUser, 'invitation-1')).resolves.toMatchObject({
      invitationId: 'invitation-2',
      invitationUrl: 'https://app.viewpro.test/team-invitations/fresh-token',
    })
    expect(repository.resendInvitation).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      invitationId: 'invitation-1',
      invitedByUserId: 'user-1',
    })
  })

  it('maps resend not found and unavailable states', async () => {
    const repository = { resendInvitation: vi.fn().mockResolvedValueOnce({ status: 'notFound' }).mockResolvedValueOnce({ status: 'notAvailable' }) }
    const useCase = new ResendTeamInvitationUseCase(repository as never, configService as never)

    await expect(useCase.execute(tenant, currentUser, 'missing')).rejects.toThrow(
      new NotFoundException('Team invitation not found'),
    )
    await expect(useCase.execute(tenant, currentUser, 'expired')).rejects.toThrow(
      new GoneException('Team invitation is no longer available'),
    )
  })

  it('rejects resend without TEAM_MANAGE', async () => {
    const repository = { resendInvitation: vi.fn() }
    const useCase = new ResendTeamInvitationUseCase(repository as never, configService as never)

    await expect(
      useCase.execute({ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] }, currentUser, 'invitation-1'),
    ).rejects.toThrow(new ForbiddenException('Insufficient permissions'))
  })

  it('revokes an invitation without returning a raw token or token hash', async () => {
    const repository = {
      revokeInvitation: vi.fn().mockResolvedValue({
        status: 'revoked',
        invitation: invitation({ status: TeamInvitationStatus.REVOKED, revokedAt: new Date('2026-06-01T10:00:00.000Z') }),
      }),
    }
    const useCase = new RevokeTeamInvitationUseCase(repository as never)

    const result = await useCase.execute(tenant, 'invitation-1')

    expect(repository.revokeInvitation).toHaveBeenCalledWith({ tenantId: 'tenant-1', invitationId: 'invitation-1' })
    expect(result).toEqual({
      invitationId: 'invitation-1',
      email: 'seller@example.com',
      role: TenantRole.AGENT,
      status: TeamInvitationStatus.REVOKED,
      expiresAt: '2026-06-14T10:00:00.000Z',
      revokedAt: '2026-06-01T10:00:00.000Z',
    })
    expect(result).not.toHaveProperty('invitationUrl')
    expect(JSON.stringify(result)).not.toContain('tokenHash')
    expect(JSON.stringify(result)).not.toContain('raw-token')
  })

  it('maps revoke not found and unavailable states', async () => {
    const repository = { revokeInvitation: vi.fn().mockResolvedValueOnce({ status: 'notFound' }).mockResolvedValueOnce({ status: 'notAvailable' }) }
    const useCase = new RevokeTeamInvitationUseCase(repository as never)

    await expect(useCase.execute(tenant, 'missing')).rejects.toThrow(new NotFoundException('Team invitation not found'))
    await expect(useCase.execute(tenant, 'expired')).rejects.toThrow(
      new GoneException('Team invitation is no longer available'),
    )
  })

  it('rejects revoke without TEAM_MANAGE', async () => {
    const repository = { revokeInvitation: vi.fn() }
    const useCase = new RevokeTeamInvitationUseCase(repository as never)

    await expect(useCase.execute({ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] }, 'invitation-1')).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    )
  })
})

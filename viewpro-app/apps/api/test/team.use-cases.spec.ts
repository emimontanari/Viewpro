import { ForbiddenException } from '@nestjs/common'
import { GlobalRole, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../src/permissions/permissions.constants'
import { ListTeamMembersUseCase } from '../src/team/use-cases/list-team-members.use-case'
import type { TenantContext } from '../src/tenant-context/tenant-context.types'

const tenant: TenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  tenantStatus: TenantStatus.ACTIVE,
  membershipId: 'membership-current',
  role: TenantRole.MANAGER,
  permissions: [PERMISSIONS.TEAM_VIEW],
  userStatus: UserStatus.ACTIVE,
}

describe('ListTeamMembersUseCase', () => {
  it('maps tenant memberships to safe team member responses', async () => {
    const membershipsRepository = {
      findManyByTenantId: vi.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          role: TenantRole.MANAGER,
          createdAt: new Date('2026-05-01T10:00:00.000Z'),
          updatedAt: new Date('2026-05-02T10:00:00.000Z'),
          user: {
            id: 'user-1',
            email: 'manager@example.com',
            passwordHash: 'secret',
            firstName: 'Ana',
            lastName: 'Gómez',
            status: UserStatus.ACTIVE,
            globalRole: GlobalRole.USER,
            emailVerifiedAt: null,
            createdAt: new Date('2026-04-01T10:00:00.000Z'),
            updatedAt: new Date('2026-04-02T10:00:00.000Z'),
          },
          tenant: {
            id: 'tenant-1',
            name: 'Tenant One',
            slug: 'tenant-one',
            status: TenantStatus.ACTIVE,
            createdAt: new Date('2026-03-01T10:00:00.000Z'),
            updatedAt: new Date('2026-03-02T10:00:00.000Z'),
          },
        },
      ]),
    }

    const useCase = new ListTeamMembersUseCase(membershipsRepository as never)

    await expect(useCase.execute(tenant)).resolves.toEqual({
      items: [
        {
          membershipId: 'membership-1',
          userId: 'user-1',
          email: 'manager@example.com',
          firstName: 'Ana',
          lastName: 'Gómez',
          userStatus: UserStatus.ACTIVE,
          role: TenantRole.MANAGER,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-02T10:00:00.000Z',
        },
      ],
    })

    expect(membershipsRepository.findManyByTenantId).toHaveBeenCalledWith('tenant-1')
  })

  it('rejects listing without TEAM_VIEW permission', async () => {
    const membershipsRepository = { findManyByTenantId: vi.fn() }
    const useCase = new ListTeamMembersUseCase(membershipsRepository as never)

    await expect(useCase.execute({ ...tenant, permissions: [PERMISSIONS.TENANT_VIEW] })).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    )

    expect(membershipsRepository.findManyByTenantId).not.toHaveBeenCalled()
  })
})

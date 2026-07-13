import { NotFoundException } from '@nestjs/common'
import { TenantStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandActor } from '../admin-actor'
import { ADMIN_TENANT_LIMITS_REPOSITORY } from '../admin-tenant-limits.repository'
import { AdminTenantLimitsService } from '../admin-tenant-limits.service'

// ---------------------------------------------------------------------------
// Spec: Dual-Actor Audit Attribution (limits service)
// Scenarios:
//   - Operator actor → repo receives { type:'operator', operatorId:'op-1' }
//   - User actor     → repo receives { type:'user', userId:'u-1' } (regression)
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1'

const baseLimits = {
  maxUsers: 10,
  maxActivePropertyEngagements: 5,
  maxDocumentsStorageMb: 100,
}

function makeLimitsRepoStub() {
  return {
    updateTenantLimits: vi.fn().mockResolvedValue({
      status: 'updated',
      tenantId: TENANT_ID,
      previousLimits: baseLimits,
      limits: baseLimits,
      updatedAt: new Date(),
    }),
  }
}

describe('AdminTenantLimitsService — CommandActor dual-actor attribution', () => {
  let repoStub: ReturnType<typeof makeLimitsRepoStub>
  let service: AdminTenantLimitsService

  beforeEach(() => {
    repoStub = makeLimitsRepoStub()
    service = new AdminTenantLimitsService(repoStub as any)
  })

  describe('Operator actor path (control-lane command stamps operator actor)', () => {
    it('calls repo with operator actor', async () => {
      const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

      await service.updateTenantLimits({
        tenantId: TENANT_ID,
        limits: baseLimits,
        actor,
      })

      expect(repoStub.updateTenantLimits).toHaveBeenCalledOnce()
      const repoCall = repoStub.updateTenantLimits.mock.calls[0]![0]
      expect(repoCall.actor.type).toBe('operator')
      expect((repoCall.actor as Extract<CommandActor, { type: 'operator' }>).operatorId).toBe('op-1')
    })
  })

  describe('User actor path (admin-route command stamps user actor — regression)', () => {
    it('calls repo with user actor when type=user', async () => {
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      await service.updateTenantLimits({
        tenantId: TENANT_ID,
        limits: baseLimits,
        actor,
      })

      const repoCall = repoStub.updateTenantLimits.mock.calls[0]![0]
      expect(repoCall.actor.type).toBe('user')
      expect((repoCall.actor as Extract<CommandActor, { type: 'user' }>).userId).toBe('u-1')
    })
  })

  describe('error handling', () => {
    it('throws NotFoundException when repo returns notFound', async () => {
      repoStub.updateTenantLimits.mockResolvedValueOnce({ status: 'notFound' })
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      await expect(
        service.updateTenantLimits({
          tenantId: TENANT_ID,
          limits: baseLimits,
          actor,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException for invalid limit value', async () => {
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      const { BadRequestException } = await import('@nestjs/common')
      await expect(
        service.updateTenantLimits({
          tenantId: TENANT_ID,
          limits: { maxUsers: -5, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
          actor,
        }),
      ).rejects.toThrow(BadRequestException)
    })
  })
})

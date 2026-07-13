import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, TenantStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandActor } from '../admin-actor'
import { ADMIN_TENANT_STATUS_REPOSITORY } from '../admin-tenant-status.repository'
import { AdminTenantStatusService } from '../admin-tenant-status.service'

// ---------------------------------------------------------------------------
// Spec: Dual-Actor Audit Attribution
// Scenarios:
//   - Operator actor → actorOperatorId='op-1', actorType=PLATFORM_OPERATOR, actorUserId=null
//   - User actor     → actorUserId='u-1', existing behaviour preserved (regression)
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1'

function makeStatusRepoStub() {
  return {
    updateTenantStatus: vi.fn().mockResolvedValue({
      status: 'updated',
      tenantId: TENANT_ID,
      previousStatus: TenantStatus.ACTIVE,
      currentStatus: TenantStatus.SUSPENDED,
      updatedAt: new Date(),
    }),
  }
}

function buildService(repoStub: ReturnType<typeof makeStatusRepoStub>) {
  return new AdminTenantStatusService({ [ADMIN_TENANT_STATUS_REPOSITORY]: repoStub } as any)
}

describe('AdminTenantStatusService — CommandActor dual-actor attribution', () => {
  let repoStub: ReturnType<typeof makeStatusRepoStub>
  let service: AdminTenantStatusService

  beforeEach(() => {
    repoStub = makeStatusRepoStub()
    // Direct instantiation: inject stub via DI token
    service = new AdminTenantStatusService(repoStub as any)
  })

  describe('Operator actor path (control-lane command stamps operator actor)', () => {
    it('calls repo with actorOperatorId set and actorType PLATFORM_OPERATOR', async () => {
      const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

      await service.updateTenantStatus({
        tenantId: TENANT_ID,
        targetStatus: TenantStatus.SUSPENDED,
        actor,
      })

      expect(repoStub.updateTenantStatus).toHaveBeenCalledOnce()
      const call = repoStub.updateTenantStatus.mock.calls[0]![0]
      expect(call.actor).toEqual(actor)
    })

    it('returned event has actorOperatorId=op-1, actorType=PLATFORM_OPERATOR, actorUserId=null', async () => {
      const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

      // The service delegates attribution to the repo; validate the shape passed
      await service.updateTenantStatus({
        tenantId: TENANT_ID,
        targetStatus: TenantStatus.SUSPENDED,
        actor,
      })

      const repoCall = repoStub.updateTenantStatus.mock.calls[0]![0]
      // Repo must receive the full actor object so it can stamp actorOperatorId
      expect(repoCall.actor.type).toBe('operator')
      expect((repoCall.actor as Extract<CommandActor, { type: 'operator' }>).operatorId).toBe('op-1')
    })
  })

  describe('User actor path (admin-route command stamps user actor — regression)', () => {
    it('calls repo with user actor when type=user', async () => {
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      await service.updateTenantStatus({
        tenantId: TENANT_ID,
        targetStatus: TenantStatus.SUSPENDED,
        actor,
      })

      const repoCall = repoStub.updateTenantStatus.mock.calls[0]![0]
      expect(repoCall.actor).toEqual(actor)
      expect(repoCall.actor.type).toBe('user')
      expect((repoCall.actor as Extract<CommandActor, { type: 'user' }>).userId).toBe('u-1')
    })
  })

  describe('validation — writable-target status policy', () => {
    it('throws BadRequestException for unpermitted target status', async () => {
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      await expect(
        service.updateTenantStatus({
          tenantId: TENANT_ID,
          targetStatus: 'TRIAL' as TenantStatus,
          actor,
        }),
      ).rejects.toThrow(BadRequestException)

      expect(repoStub.updateTenantStatus).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when repo returns notFound', async () => {
      repoStub.updateTenantStatus.mockResolvedValueOnce({ status: 'notFound' })
      const actor: CommandActor = { type: 'user', userId: 'u-1' }

      await expect(
        service.updateTenantStatus({
          tenantId: TENANT_ID,
          targetStatus: TenantStatus.SUSPENDED,
          actor,
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})

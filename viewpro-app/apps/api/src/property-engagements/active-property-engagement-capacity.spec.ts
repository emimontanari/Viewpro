import { PropertyEngagementStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  ActivePropertyCapacityExceededError,
  ActivePropertyEngagementCapacity,
} from './active-property-engagement-capacity'

describe('ActivePropertyEngagementCapacity', () => {
  function transaction(
    limit: number | null,
    count = 0,
  ) {
    const calls: string[] = []
    const tx = {
      $queryRaw: vi.fn(async () => {
        calls.push('lock')
      }),
      tenant: {
        findUnique: vi.fn(async () => {
          calls.push('tenant')
          return { maxActivePropertyEngagements: limit }
        }),
      },
      propertyEngagement: {
        count: vi.fn(async (_args) => {
          calls.push('count')
          return count
        }),
      },
      propertyProposal: { count: vi.fn() },
    }
    return { tx, calls }
  }

  it('locks before reading tenant capacity and counting canonical active rows', async () => {
    const { tx, calls } = transaction(3, 2)
    const capacity = new ActivePropertyEngagementCapacity()
    const lease = await capacity.acquire(
      tx as never,
      'tenant-1',
    )

    await lease.assertAvailable()

    expect(calls).toEqual(['lock', 'tenant', 'count'])
    expect(tx.propertyEngagement.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        status: {
          notIn: [
            PropertyEngagementStatus.CLOSED,
            PropertyEngagementStatus.CANCELLED,
          ],
        },
      },
    })
    expect(tx).not.toHaveProperty('$transaction')
    expect(tx.propertyProposal.count).not.toHaveBeenCalled()
  })

  it('skips the canonical count for an unlimited tenant', async () => {
    const { tx, calls } = transaction(null)
    const capacity = new ActivePropertyEngagementCapacity()
    const lease = await capacity.acquire(
      tx as never,
      'tenant-1',
    )

    await lease.assertAvailable()

    expect(calls).toEqual(['lock', 'tenant'])
    expect(tx.propertyEngagement.count).not.toHaveBeenCalled()
  })

  it('throws a transport-neutral error at the exact active capacity limit', async () => {
    const { tx } = transaction(2, 2)
    const capacity = new ActivePropertyEngagementCapacity()
    const lease = await capacity.acquire(
      tx as never,
      'tenant-1',
    )

    await expect(
      lease.assertAvailable(),
    ).rejects.toBeInstanceOf(
      ActivePropertyCapacityExceededError,
    )
  })
})

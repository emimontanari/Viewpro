import {
  InterestLevel,
  MovementSource,
  MovementType,
  PropertyEngagementStatus,
} from '@prisma/client'
import { validate } from 'class-validator'
import { describe, expect, it, vi } from 'vitest'
import { CreateMovementDto } from '../src/movements/dto/create-movement.dto'
import { ListMovementsQuery } from '../src/movements/dto/list-movements.query'
import { PrismaMovementsRepository } from '../src/movements/prisma-movements.repository'

describe('Movements foundation', () => {
  it('exposes the Stage 5 movement enums from Prisma Client', () => {
    expect(MovementType.STATUS_CHANGE).toBe('STATUS_CHANGE')
    expect(MovementSource.MANUAL).toBe('MANUAL')
    expect(InterestLevel.HIGH).toBe('HIGH')
  })

  it('validates create movement DTO fields', async () => {
    const dto = Object.assign(new CreateMovementDto(), {
      type: MovementType.INQUIRY,
      observation: 'Buyer asked for a visit.',
      nextStep: 'Schedule visit',
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
      interestCount: 2,
      visitCount: 1,
      offerAmountCents: 100_000_00,
      interestLevel: InterestLevel.HIGH,
    })

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('rejects invalid movement list pagination and order', async () => {
    const query = Object.assign(new ListMovementsQuery(), {
      page: 0,
      pageSize: 51,
      order: 'oldest',
    })

    const errors = await validate(query)

    expect(errors.map((error) => error.property)).toEqual(['page', 'pageSize', 'order'])
  })

  it('creates a movement without changing engagement status', async () => {
    const engagement = { id: 'engagement-1', status: PropertyEngagementStatus.CAPTURE }
    const createdMovement = { id: 'movement-1', tenantId: 'tenant-1', createdBy: { id: 'user-1' } }
    const findFirst = vi.fn().mockResolvedValue(engagement)
    const create = vi.fn().mockResolvedValue(createdMovement)
    const update = vi.fn()
    const transaction = vi.fn(async (callback) =>
      callback({ propertyEngagement: { findFirst, update }, movement: { create } }),
    )
    const repository = new PrismaMovementsRepository({ $transaction: transaction } as never)

    const result = await repository.create({
      tenantId: 'tenant-1',
      propertyEngagementId: 'engagement-1',
      createdByUserId: 'user-1',
      type: MovementType.GENERAL_UPDATE,
      observation: 'Owner sent updated photos.',
      nextStep: 'Refresh listing assets',
    })

    expect(result).toBe(createdMovement)
    expect(transaction).toHaveBeenCalledOnce()
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'engagement-1', tenantId: 'tenant-1' } })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          propertyEngagementId: 'engagement-1',
          createdByUserId: 'user-1',
          previousStatus: null,
          newStatus: null,
        }),
      }),
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('creates a movement and updates engagement status in one transaction', async () => {
    const engagement = { id: 'engagement-1', status: PropertyEngagementStatus.ACTIVE_PUBLICATION }
    const createdMovement = { id: 'movement-1', newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS }
    const findFirst = vi.fn().mockResolvedValue(engagement)
    const create = vi.fn().mockResolvedValue(createdMovement)
    const update = vi.fn().mockResolvedValue({ id: 'engagement-1' })
    const transaction = vi.fn(async (callback) =>
      callback({ propertyEngagement: { findFirst, update }, movement: { create } }),
    )
    const repository = new PrismaMovementsRepository({ $transaction: transaction } as never)

    await expect(
      repository.create({
        tenantId: 'tenant-1',
        propertyEngagementId: 'engagement-1',
        createdByUserId: 'user-1',
        type: MovementType.STATUS_CHANGE,
        observation: 'First inquiry received.',
        newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
      }),
    ).resolves.toBe(createdMovement)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
          newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
        }),
      }),
    )
    expect(update).toHaveBeenCalledWith({
      where: { id: 'engagement-1' },
      data: { status: PropertyEngagementStatus.INQUIRIES_AND_VISITS },
    })
  })

  it('returns null when creating for a missing tenant engagement', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const create = vi.fn()
    const transaction = vi.fn(async (callback) =>
      callback({ propertyEngagement: { findFirst }, movement: { create } }),
    )
    const repository = new PrismaMovementsRepository({ $transaction: transaction } as never)

    const result = await repository.create({
      tenantId: 'tenant-1',
      propertyEngagementId: 'missing-engagement',
      createdByUserId: 'user-1',
      type: MovementType.GENERAL_UPDATE,
      observation: 'Should not be created.',
    })

    expect(result).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('lists only movements for the requested tenant engagement', async () => {
    const items = [{ id: 'movement-1', tenantId: 'tenant-1', propertyEngagementId: 'engagement-1' }]
    const findMany = vi.fn().mockResolvedValue(items)
    const count = vi.fn().mockResolvedValue(1)
    const repository = new PrismaMovementsRepository({ movement: { findMany, count } } as never)

    await expect(
      repository.findMany({
        tenantId: 'tenant-1',
        propertyEngagementId: 'engagement-1',
        page: 2,
        pageSize: 10,
        order: 'asc',
      }),
    ).resolves.toEqual({ items, total: 1 })

    const where = { tenantId: 'tenant-1', propertyEngagementId: 'engagement-1' }
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: { createdAt: 'asc' },
        skip: 10,
        take: 10,
      }),
    )
    expect(count).toHaveBeenCalledWith({ where })
  })
})

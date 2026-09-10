import 'reflect-metadata'

import { PropertyProposalStatus } from '@prisma/client'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { ApprovePropertyProposalDto } from './approve-property-proposal.dto'
import { ListPropertyProposalReviewQuery } from './list-property-proposal-review.query'
import { RejectPropertyProposalDto } from './reject-property-proposal.dto'

const validationErrors = <T extends object>(Dto: new () => T, input: object) =>
  validate(plainToInstance(Dto, input), { whitelist: true, forbidNonWhitelisted: true })

const reviewRoundId = '4c2f7c4a-5320-4b7b-a9e3-d734869f7ad7'

describe('reviewer property proposal DTOs', () => {
  it('converts the supported review filters and defaults pagination', async () => {
    const defaults = plainToInstance(ListPropertyProposalReviewQuery, {})
    const explicit = plainToInstance(ListPropertyProposalReviewQuery, {
      state: PropertyProposalStatus.RECHAZADA,
      history: 'REJECTED',
      page: '2',
      pageSize: '50',
    })

    expect(await validationErrors(ListPropertyProposalReviewQuery, {})).toHaveLength(0)
    expect(defaults).toMatchObject({ page: 1, pageSize: 20 })
    expect(await validationErrors(ListPropertyProposalReviewQuery, explicit)).toHaveLength(0)
    expect(explicit).toMatchObject({ state: 'RECHAZADA', history: 'REJECTED', page: 2, pageSize: 50 })
  })

  it('rejects unsupported search, invalid filter values, pagination, and unknown keys', async () => {
    for (const query of [
      { search: 'casa' },
      { state: 'PENDING' },
      { history: 'ALL' },
      { page: '0' },
      { pageSize: '51' },
      { page: 'Infinity' },
      { tenantId: 'forged' },
    ]) {
      expect(await validationErrors(ListPropertyProposalReviewQuery, query)).not.toHaveLength(0)
    }
  })

  it('requires a UUID review round for approval and admits rejection reason for use-case validation', async () => {
    expect(await validationErrors(ApprovePropertyProposalDto, { reviewRoundId })).toHaveLength(0)
    expect(await validationErrors(RejectPropertyProposalDto, { reviewRoundId, reason: '  Needs an address  ' })).toHaveLength(0)
    expect(await validationErrors(RejectPropertyProposalDto, { reviewRoundId, reason: 42 })).toHaveLength(0)

    for (const input of [
      {},
      { reviewRoundId: 'not-a-uuid' },
      { reviewRoundId, unknown: true },
    ]) {
      expect(await validationErrors(ApprovePropertyProposalDto, input)).not.toHaveLength(0)
      expect(await validationErrors(RejectPropertyProposalDto, input)).not.toHaveLength(0)
    }
  })
})

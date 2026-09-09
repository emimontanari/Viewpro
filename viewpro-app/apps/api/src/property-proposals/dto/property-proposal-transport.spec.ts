import 'reflect-metadata'

import { PropertyOperationType, PropertyType } from '@prisma/client'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreatePropertyProposalDto } from './create-property-proposal.dto'
import { ListPropertyProposalsQuery } from './list-property-proposals.query'
import { PropertyProposalIdParams } from './property-proposal-id.params'
import { SubmitPropertyProposalDto } from './submit-property-proposal.dto'
import { UpdatePropertyProposalDto } from './update-property-proposal.dto'

const validationErrors = <T extends object>(Dto: new () => T, input: object) =>
  validate(plainToInstance(Dto, input), { whitelist: true, forbidNonWhitelisted: true })

const validCreate = {
  title: 'Casa del parque',
  addressLine: 'Calle 1',
  city: 'Rosario',
  province: 'Santa Fe',
  propertyType: PropertyType.HOUSE,
  operationType: PropertyOperationType.SALE,
  totalAreaSqm: 100,
  coveredAreaSqm: 80,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  garages: 1,
  ageYears: 10,
  orientation: 'Norte',
  ownerName: 'Ada Lovelace',
  ownerEmail: 'ada@example.com',
  publishedPriceCents: 100_000,
  currency: 'ARS',
}

describe('seller property proposal DTOs', () => {
  it('accepts the complete create contract and nullable optional fields', async () => {
    expect(await validationErrors(CreatePropertyProposalDto, validCreate)).toHaveLength(0)
    expect(
      await validationErrors(CreatePropertyProposalDto, {
        title: 'Draft',
        addressLine: null,
        city: null,
        province: null,
        propertyType: null,
        operationType: null,
        totalAreaSqm: null,
        coveredAreaSqm: null,
        rooms: null,
        bedrooms: null,
        bathrooms: null,
        garages: null,
        ageYears: null,
        orientation: null,
        ownerName: null,
        ownerEmail: null,
        publishedPriceCents: null,
        currency: null,
      }),
    ).toHaveLength(0)
  })

  it('enforces every field bound and rejects enum, email, and wrong types', async () => {
    for (const input of [
      { ...validCreate, title: null },
      { ...validCreate, title: 'x'.repeat(121) },
      { ...validCreate, propertyType: 'HOME' },
      { ...validCreate, operationType: 'LEASE' },
      { ...validCreate, ownerEmail: 'not-an-email' },
    ]) expect(await validationErrors(CreatePropertyProposalDto, input)).not.toHaveLength(0)

    for (const [field, maximum] of [
      ['addressLine', 180],
      ['city', 80],
      ['province', 80],
      ['orientation', 16],
      ['ownerName', 120],
      ['currency', 3],
    ] as const) {
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [field]: 'x'.repeat(maximum + 1) })).not.toHaveLength(0)
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [field]: 1 })).not.toHaveLength(0)
    }

    for (const field of ['totalAreaSqm', 'coveredAreaSqm', 'rooms', 'bedrooms', 'bathrooms', 'garages', 'ageYears', 'publishedPriceCents']) {
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [field]: -1 })).not.toHaveLength(0)
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [field]: 1.5 })).not.toHaveLength(0)
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [field]: '1' })).not.toHaveLength(0)
    }
  })

  it('keeps update title optional but rejects its null value while accepting other nulls', async () => {
    expect(await validationErrors(UpdatePropertyProposalDto, { expectedVersion: 1 })).toHaveLength(0)
    expect(
      await validationErrors(UpdatePropertyProposalDto, {
        expectedVersion: 1,
        addressLine: null,
        totalAreaSqm: null,
        propertyType: null,
      }),
    ).toHaveLength(0)
    expect(await validationErrors(UpdatePropertyProposalDto, { expectedVersion: 1, title: null })).not.toHaveLength(0)
  })

  it('requires positive numeric versions without accepting numeric strings or non-finite values', async () => {
    for (const Dto of [UpdatePropertyProposalDto, SubmitPropertyProposalDto]) {
      expect(await validationErrors(Dto, { expectedVersion: 1 })).toHaveLength(0)
      for (const expectedVersion of [undefined, null, 0, -1, 1.5, '1', Number.NaN, Infinity]) {
        expect(await validationErrors(Dto, { expectedVersion })).not.toHaveLength(0)
      }
    }
  })

  it('rejects unknown and protected fields through the whitelist contract', async () => {
    for (const key of ['unknown', 'tenantId', 'proposedByUserId', 'sourceEngagement', 'assignment', 'membership']) {
      expect(await validationErrors(CreatePropertyProposalDto, { ...validCreate, [key]: 'protected' })).not.toHaveLength(0)
    }
  })

  it('defaults and explicitly converts pagination query strings within strict bounds', async () => {
    const defaults = plainToInstance(ListPropertyProposalsQuery, {})
    expect(await validate(defaults)).toHaveLength(0)
    expect(defaults).toMatchObject({ page: 1, pageSize: 20 })

    const explicit = plainToInstance(ListPropertyProposalsQuery, { page: '2', pageSize: '50' })
    expect(await validate(explicit)).toHaveLength(0)
    expect(explicit).toMatchObject({ page: 2, pageSize: 50 })

    for (const input of [
      { page: '0' },
      { page: '1.5' },
      { page: 'Infinity' },
      { pageSize: '0' },
      { pageSize: '51' },
      { pageSize: 'NaN' },
    ]) {
      expect(await validate(plainToInstance(ListPropertyProposalsQuery, input))).not.toHaveLength(0)
    }
  })

  it('accepts UUID proposal parameters and rejects malformed values', async () => {
    expect(
      await validationErrors(PropertyProposalIdParams, { proposalId: '4c2f7c4a-5320-4b7b-a9e3-d734869f7ad7' }),
    ).toHaveLength(0)
    expect(await validationErrors(PropertyProposalIdParams, { proposalId: 'not-a-uuid' })).not.toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  assertDraftTitle,
  assertSubmissionFields,
  createStagedScalarSnapshot,
  normalizeStagedScalars,
  PROPERTY_OPERATION_TYPES,
  PROPERTY_TYPES,
  type StagedPropertyScalars,
} from './normalization'

function createCompleteStagedScalars(
  overrides: Partial<StagedPropertyScalars> = {},
): StagedPropertyScalars {
  return {
    title: 'Casa',
    addressLine: 'Calle 123',
    city: 'Córdoba',
    province: 'Córdoba',
    propertyType: 'HOUSE',
    operationType: 'SALE',
    totalAreaSqm: 100,
    coveredAreaSqm: 80,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    garages: 1,
    ageYears: 5,
    orientation: 'N',
    ownerName: 'Ana',
    ownerEmail: 'ana@example.com',
    publishedPriceCents: 500_000,
    currency: 'USD',
    ...overrides,
  }
}

const requiredSubmissionFields = [
  'title',
  'addressLine',
  'city',
  'province',
  'propertyType',
  'operationType',
] as const

describe('property proposal normalization', () => {
  it('exports the exact pure Prisma-schema enum values', () => {
    expect(PROPERTY_TYPES).toEqual(['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER'])
    expect(PROPERTY_OPERATION_TYPES).toEqual(['SALE', 'RENT'])
  })

  it('trims staged text and valid enum boundary strings while converting blanks to null', () => {
    expect(normalizeStagedScalars({
      ...createCompleteStagedScalars(),
      title: '  Casa Norte  ',
      addressLine: '  Calle 123 ',
      city: ' Córdoba ',
      province: ' ',
      propertyType: ' APARTMENT ',
      operationType: ' ',
      orientation: '  NE ',
      ownerName: ' ',
      ownerEmail: ' ',
      currency: ' USD ',
    })).toEqual(createCompleteStagedScalars({
      title: 'Casa Norte',
      addressLine: 'Calle 123',
      city: 'Córdoba',
      province: null,
      propertyType: 'APARTMENT',
      operationType: null,
      orientation: 'NE',
      ownerName: null,
      ownerEmail: null,
    }))
  })

  it.each([
    ['propertyType', { propertyType: ' VILLA ' }, 'unsupported property type'],
    ['operationType', { operationType: ' LEASE ' }, 'unsupported operation type'],
  ])('rejects unsupported nonblank %s enum strings', (_field, input, message) => {
    expect(() => normalizeStagedScalars(input)).toThrow(message)
  })

  it('requires a nonblank draft title', () => {
    expect(() => assertDraftTitle({ title: '   ' })).toThrow('title is required')
  })

  it.each(requiredSubmissionFields)('requires %s when missing or blank', (field) => {
    const complete = createCompleteStagedScalars()
    expect(() => assertSubmissionFields({ ...complete, [field]: undefined }))
      .toThrow(`${field} is required`)
    expect(() => assertSubmissionFields({ ...complete, [field]: '   ' }))
      .toThrow(`${field} is required`)
  })

  it('accepts all six required submission fields', () => {
    expect(() => assertSubmissionFields(createCompleteStagedScalars())).not.toThrow()
  })

  it('copies every staged scalar into an immutable snapshot', () => {
    const staged = normalizeStagedScalars(createCompleteStagedScalars())
    const snapshot = createStagedScalarSnapshot(staged)
    staged.title = 'Changed'

    expect(snapshot).toEqual(createCompleteStagedScalars())
    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})

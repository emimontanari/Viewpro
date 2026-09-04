export const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_OPERATION_TYPES = ['SALE', 'RENT'] as const
export type PropertyOperationType = (typeof PROPERTY_OPERATION_TYPES)[number]

export type StagedPropertyScalars = {
  title: string | null
  addressLine: string | null
  city: string | null
  province: string | null
  propertyType: PropertyType | null
  operationType: PropertyOperationType | null
  totalAreaSqm: number | null
  coveredAreaSqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  garages: number | null
  ageYears: number | null
  orientation: string | null
  ownerName: string | null
  ownerEmail: string | null
  publishedPriceCents: number | null
  currency: string | null
}

export type StagedPropertyScalarsInput = Omit<StagedPropertyScalars, 'propertyType' | 'operationType'> & {
  propertyType: string | null
  operationType: string | null
}

export const STAGED_PROPERTY_SCALAR_KEYS: readonly (keyof StagedPropertyScalars)[] = [
  'title', 'addressLine', 'city', 'province', 'propertyType', 'operationType', 'totalAreaSqm',
  'coveredAreaSqm', 'rooms', 'bedrooms', 'bathrooms', 'garages', 'ageYears', 'orientation',
  'ownerName', 'ownerEmail', 'publishedPriceCents', 'currency',
]

export function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizePropertyType(value: unknown): PropertyType | null {
  switch (normalizeOptionalText(value)) {
    case null: return null
    case 'HOUSE': return 'HOUSE'
    case 'APARTMENT': return 'APARTMENT'
    case 'LAND': return 'LAND'
    case 'COMMERCIAL': return 'COMMERCIAL'
    case 'OTHER': return 'OTHER'
    default: throw new Error('unsupported property type')
  }
}

function normalizePropertyOperationType(value: unknown): PropertyOperationType | null {
  switch (normalizeOptionalText(value)) {
    case null: return null
    case 'SALE': return 'SALE'
    case 'RENT': return 'RENT'
    default: throw new Error('unsupported operation type')
  }
}

export function normalizeStagedScalars(input: Partial<StagedPropertyScalarsInput>): StagedPropertyScalars {
  return {
    title: normalizeOptionalText(input.title),
    addressLine: normalizeOptionalText(input.addressLine),
    city: normalizeOptionalText(input.city),
    province: normalizeOptionalText(input.province),
    propertyType: normalizePropertyType(input.propertyType),
    operationType: normalizePropertyOperationType(input.operationType),
    totalAreaSqm: input.totalAreaSqm ?? null,
    coveredAreaSqm: input.coveredAreaSqm ?? null,
    rooms: input.rooms ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    garages: input.garages ?? null,
    ageYears: input.ageYears ?? null,
    orientation: normalizeOptionalText(input.orientation),
    ownerName: normalizeOptionalText(input.ownerName),
    ownerEmail: normalizeOptionalText(input.ownerEmail),
    publishedPriceCents: input.publishedPriceCents ?? null,
    currency: normalizeOptionalText(input.currency),
  }
}

export function assertDraftTitle(input: Pick<StagedPropertyScalars, 'title'>): void {
  if (!normalizeOptionalText(input.title)) throw new Error('title is required')
}

export function assertSubmissionFields(input: Pick<StagedPropertyScalars, 'title' | 'addressLine' | 'city' | 'province' | 'propertyType' | 'operationType'>): void {
  for (const field of ['title', 'addressLine', 'city', 'province', 'propertyType', 'operationType'] as const) {
    if (typeof input[field] === 'string' ? !input[field]?.trim() : input[field] === null || input[field] === undefined) {
      throw new Error(`${field} is required`)
    }
  }
}

export function createStagedScalarSnapshot(input: StagedPropertyScalars): Readonly<StagedPropertyScalars> {
  return Object.freeze({ ...input })
}

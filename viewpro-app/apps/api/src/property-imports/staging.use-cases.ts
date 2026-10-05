import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, type PropertyImportCandidate, type PropertyOperationType, type PropertyType } from '@prisma/client'
import type { CurrentUser } from '../auth/types/current-user'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { PROPERTY_IMPORTS_REPOSITORY, type PropertyImportStagingRepository } from './property-imports.repository'
import { mapFeature, mapOperationType, mapPropertyType, parseZonapropAdvertiserUrl, requiredFieldsStatus, splitLocation, validatePrice, type RequiredFields } from './zonaprop/parsing'

export type NormalizedImportCandidate = {
  externalId: string; sourceUrl: string; title: string | null; addressLine: string | null
  locationParts: string[]; typeLabel: string | null; operationLabel: string | null
  priceAmount: number | string | null; priceCurrency: string | null; features: Array<{ code: string; value: string }>
  publisherId: string; sourceSnapshot: Record<string, unknown>
}
export type CandidateEdit = Pick<RequiredFields, 'title' | 'addressLine' | 'city' | 'province'> & { propertyType: PropertyType | null; operationType: PropertyOperationType | null }
const missing = () => new NotFoundException('Property import record not found')

@Injectable()
export class CreateImportBatchUseCase {
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, currentUser: CurrentUser, url: string) {
    const parsed = parseZonapropAdvertiserUrl(url)
    if ('reason' in parsed) throw new BadRequestException(`Invalid ZonaProp advertiser URL: ${parsed.reason}`)
    return this.repository.createBatch({ tenantId: tenant.tenantId, initiatedByUserId: currentUser.id, externalSource: 'ZONAPROP', canonicalUrl: parsed.canonicalUrl, publisherId: parsed.publisherId })
  }
}

@Injectable()
export class StageImportCandidatesUseCase {
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, batchId: string, inputs: NormalizedImportCandidate[], clock: () => Date = () => new Date()) {
    const batch = await this.repository.findBatch(tenant.tenantId, batchId)
    if (!batch) throw missing()
    if (!['PENDING', 'DISCOVERING', 'SCRAPING'].includes(batch.state)) throw new BadRequestException('Import batch is not accepting staged candidates')
    const rows = []
    for (const input of inputs) {
      const prior = await this.repository.findCandidateByExternalId(tenant.tenantId, batchId, input.externalId)
      if (prior && ['CONFIRMED', 'IMPORTED', 'FAILED'].includes(prior.state)) { rows.push(prior); continue }
      const location = splitLocation(input.locationParts)
      const price = validatePrice(input.priceAmount, input.priceCurrency)
      // Start every feature at null so a re-staged listing never keeps a value it no longer reports.
      // Numeric columns are Int in the schema, so decimal areas ("57,5 m²") are rounded.
      const features: Record<string, number | string | null> = { totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, ageYears: null, orientation: null }
      for (const feature of input.features) { const mapped = mapFeature(feature.code, feature.value); if (mapped) features[mapped.field] = typeof mapped.value === 'number' ? Math.round(mapped.value) : mapped.value }
      const fields = { title: input.title?.trim() || null, addressLine: input.addressLine?.trim() || null, city: location?.city ?? null, province: location?.province ?? null, propertyType: mapPropertyType(input.typeLabel), operationType: mapOperationType(input.operationLabel) }
      const complete = requiredFieldsStatus(fields)
      const reference = await this.repository.findReference(tenant.tenantId, input.externalId)
      let state: 'READY' | 'INCOMPLETE' | 'REJECTED' | 'EXISTING' = complete.status === 'ready' ? 'READY' : 'INCOMPLETE'
      let rejectionReason: string | null = null
      let errorReason: string | null = complete.status === 'incomplete' ? `Missing required fields: ${complete.missing.join(', ')}` : null
      if (input.publisherId !== batch.publisherId) { state = 'REJECTED'; rejectionReason = 'Publisher ID does not match batch publisher' }
      else if (price && 'reason' in price) { state = 'REJECTED'; rejectionReason = `Invalid price: ${price.reason}` }
      else if (reference) state = 'EXISTING'
      const data = {
        tenantId: tenant.tenantId, batchId, externalId: input.externalId, sourceUrl: input.sourceUrl,
        sourceSnapshot: input.sourceSnapshot as Prisma.InputJsonValue, snapshotExpiresAt: new Date(clock().getTime() + 30 * 86400000),
        ...fields, ...features, publishedPriceCents: price && 'publishedPriceCents' in price ? price.publishedPriceCents : null,
        currency: price && 'currency' in price ? price.currency : null, state, rejectionReason, errorReason,
        resultingReferenceId: reference?.id ?? null,
      }
      // New READY rows start selected (review by exception); re-staging keeps a READY row's choice but never leaves a non-READY row selected.
      const update = state === 'READY' ? data : { ...data, selected: false }
      rows.push(await this.repository.upsertCandidate(tenant.tenantId, batchId, input.externalId, { ...data, selected: state === 'READY' }, update, ['CONFIRMED', 'IMPORTED', 'FAILED']))
    }
    return rows
  }
}

@Injectable()
export class EditImportCandidateUseCase {
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, candidateId: string, patch: Partial<CandidateEdit>) {
    const candidate = await this.repository.findCandidate(tenant.tenantId, candidateId)
    if (!candidate) throw missing()
    if (!['READY', 'INCOMPLETE'].includes(candidate.state)) throw new BadRequestException('Candidate state cannot be edited')
    const fields = { title: candidate.title, addressLine: candidate.addressLine, city: candidate.city, province: candidate.province, propertyType: candidate.propertyType, operationType: candidate.operationType, ...patch }
    const status = requiredFieldsStatus(fields)
    return this.updateIfUnchanged(tenant, candidate, { ...patch, state: status.status === 'ready' ? 'READY' : 'INCOMPLETE', selected: status.status === 'ready' ? candidate.selected : false, errorReason: status.status === 'ready' ? null : `Missing required fields: ${status.missing.join(', ')}` })
  }
  // Optimistic guard: confirmation may change the state between the read above and this write.
  private async updateIfUnchanged(tenant: TenantContext, candidate: PropertyImportCandidate, data: Prisma.PropertyImportCandidateUncheckedUpdateInput) {
    const updated = await this.repository.updateCandidateIfState(tenant.tenantId, candidate.id, candidate.state, data)
    if (!updated) throw new BadRequestException('Candidate changed state; reload and try again')
    return updated
  }
}

@Injectable()
export class SetImportCandidateSelectedUseCase {
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, candidateId: string, selected: boolean) {
    const candidate = await this.repository.findCandidate(tenant.tenantId, candidateId)
    if (!candidate) throw missing()
    if (selected && candidate.state !== 'READY') throw new BadRequestException('Only ready candidates can be selected')
    const updated = await this.repository.updateCandidateIfState(tenant.tenantId, candidateId, candidate.state, { selected })
    if (!updated) throw new BadRequestException('Candidate changed state; reload and try again')
    return updated
  }
}

@Injectable()
export class ListImportCandidatesUseCase {
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, batchId: string) {
    if (!await this.repository.findBatch(tenant.tenantId, batchId)) throw missing()
    const [items, counts] = await Promise.all([this.repository.listCandidates(tenant.tenantId, batchId), this.repository.countCandidates(tenant.tenantId, batchId)])
    for (const state of ['READY', 'EXISTING', 'INCOMPLETE', 'REJECTED', 'CONFIRMED', 'IMPORTED', 'FAILED']) counts[state] ??= 0
    return { items, counts }
  }
}

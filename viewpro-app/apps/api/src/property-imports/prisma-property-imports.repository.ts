import { Inject, Injectable } from '@nestjs/common'
import type { Prisma, PropertyImportCandidateState } from '@prisma/client'
import type { PropertyImportStagingRepository } from './property-imports.repository'
import { PrismaService } from '../database/prisma.service'
import { ActivePropertyEngagementCapacity } from '../property-engagements/active-property-engagement-capacity'

@Injectable()
export class PrismaPropertyImportStagingRepository implements PropertyImportStagingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, private readonly capacity: ActivePropertyEngagementCapacity = new ActivePropertyEngagementCapacity()) {}
  createBatch(data: Parameters<PropertyImportStagingRepository['createBatch']>[0]) { return this.prisma.propertyImportBatch.create({ data }) }
  findBatch(tenantId: string, batchId: string) { return this.prisma.propertyImportBatch.findFirst({ where: { tenantId, id: batchId } }) }
  findReference(tenantId: string, externalId: string) { return this.prisma.externalPropertyReference.findFirst({ where: { tenantId, externalSource: 'ZONAPROP', externalId }, select: { id: true } }) }
  upsertCandidate(tenantId: string, batchId: string, externalId: string, create: Prisma.PropertyImportCandidateUncheckedCreateInput, update: Prisma.PropertyImportCandidateUncheckedUpdateInput, protectedStates: PropertyImportCandidateState[]) {
    return this.prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM property_import_candidates WHERE "tenantId" = ${tenantId} AND "batchId" = ${batchId} AND "externalId" = ${externalId} FOR UPDATE`
      if (locked.length) {
        const current = await tx.propertyImportCandidate.findFirstOrThrow({ where: { tenantId, batchId, externalId } })
        if (protectedStates.includes(current.state)) return current
      }
      return tx.propertyImportCandidate.upsert({ where: { batchId_externalId: { batchId, externalId }, tenantId }, create, update })
    })
  }
  findCandidate(tenantId: string, candidateId: string) { return this.prisma.propertyImportCandidate.findFirst({ where: { tenantId, id: candidateId } }) }
  findCandidateByExternalId(tenantId: string, batchId: string, externalId: string) { return this.prisma.propertyImportCandidate.findFirst({ where: { tenantId, batchId, externalId } }) }
  async updateCandidateIfState(tenantId: string, candidateId: string, expectedState: PropertyImportCandidateState, data: Prisma.PropertyImportCandidateUncheckedUpdateInput) {
    const result = await this.prisma.propertyImportCandidate.updateMany({ where: { id: candidateId, tenantId, state: expectedState }, data })
    return result.count ? this.prisma.propertyImportCandidate.findFirst({ where: { id: candidateId, tenantId } }) : null
  }
  listCandidates(tenantId: string, batchId: string) { return this.prisma.propertyImportCandidate.findMany({ where: { tenantId, batchId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }) }
  async countCandidates(tenantId: string, batchId: string) {
    const groups = await this.prisma.propertyImportCandidate.groupBy({ by: ['state'], where: { tenantId, batchId }, _count: { _all: true } })
    return Object.fromEntries(groups.map(group => [group.state, group._count._all]))
  }
  async findApprovedClaim(tenantId: string, publisherId: string) { return null !== await this.prisma.publisherClaim.findFirst({ where: { tenantId, publisherId, externalSource: 'ZONAPROP', state: 'APPROVED' }, select: { id: true } }) }
  listSelectedReady(tenantId: string, batchId: string) { return this.prisma.propertyImportCandidate.findMany({ where: { tenantId, batchId, state: 'READY', selected: true }, orderBy: { createdAt: 'asc' } }) }
  async importCandidate(tenantId: string, candidateId: string, userId: string) {
    return this.prisma.$transaction(async tx => {
      const candidate = await tx.propertyImportCandidate.findFirst({ where: { id: candidateId, tenantId, state: 'READY', selected: true } })
      if (!candidate) return { imported: false }
      const changed = await tx.propertyImportCandidate.updateMany({ where: { id: candidateId, tenantId, state: 'READY', selected: true }, data: { state: 'CONFIRMED' } })
      if (!changed.count) return { imported: false }
      const capacity = await this.capacity.acquire(tx, tenantId); await capacity.assertAvailable()
      const asset = await tx.propertyAsset.create({ data: { title: candidate.title!, addressLine: candidate.addressLine!, city: candidate.city!, province: candidate.province!, propertyType: candidate.propertyType!, totalAreaSqm: candidate.totalAreaSqm, coveredAreaSqm: candidate.coveredAreaSqm, rooms: candidate.rooms, bedrooms: candidate.bedrooms, bathrooms: candidate.bathrooms, garages: candidate.garages, ageYears: candidate.ageYears, orientation: candidate.orientation, ownerName: null, ownerEmail: null, createdByUserId: userId } })
      const engagement = await tx.propertyEngagement.create({ data: { tenantId, propertyAssetId: asset.id, operationType: candidate.operationType!, publishedPriceCents: candidate.publishedPriceCents, currency: candidate.currency ?? 'ARS', createdByUserId: userId } })
      const reference = await tx.externalPropertyReference.create({ data: { tenantId, externalSource: 'ZONAPROP', externalId: candidate.externalId, propertyEngagementId: engagement.id } })
      await tx.propertyImportCandidate.update({ where: { id: candidateId }, data: { state: 'IMPORTED', resultingReferenceId: reference.id, errorReason: null } })
      return { imported: true, referenceId: reference.id }
    })
  }
  async markCandidate(tenantId: string, candidateId: string, expectedState: PropertyImportCandidateState, data: Prisma.PropertyImportCandidateUncheckedUpdateInput) { await this.prisma.propertyImportCandidate.updateMany({ where: { id: candidateId, tenantId, state: expectedState }, data }) }
}

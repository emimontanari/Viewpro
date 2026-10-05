import { Inject, Injectable } from '@nestjs/common'
import type { Prisma, PropertyImportCandidateState } from '@prisma/client'
import type { PropertyImportStagingRepository } from './property-imports.repository'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class PrismaPropertyImportStagingRepository implements PropertyImportStagingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
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
  updateCandidate(tenantId: string, candidateId: string, data: Prisma.PropertyImportCandidateUncheckedUpdateInput) {
    return this.prisma.propertyImportCandidate.update({ where: { id: candidateId, tenantId }, data })
  }
  listCandidates(tenantId: string, batchId: string) { return this.prisma.propertyImportCandidate.findMany({ where: { tenantId, batchId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }) }
  async countCandidates(tenantId: string, batchId: string) {
    const groups = await this.prisma.propertyImportCandidate.groupBy({ by: ['state'], where: { tenantId, batchId }, _count: { _all: true } })
    return Object.fromEntries(groups.map(group => [group.state, group._count._all]))
  }
}

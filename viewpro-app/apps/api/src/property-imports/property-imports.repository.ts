import type { Prisma, PropertyImportBatch, PropertyImportCandidate, PropertyImportCandidateState } from '@prisma/client'

export const PROPERTY_IMPORTS_REPOSITORY = Symbol('PROPERTY_IMPORTS_REPOSITORY')
export interface PropertyImportStagingRepository {
  createBatch(data: { tenantId: string; initiatedByUserId: string; externalSource: 'ZONAPROP'; canonicalUrl: string; publisherId: string }): Promise<PropertyImportBatch>
  findBatch(tenantId: string, batchId: string): Promise<PropertyImportBatch | null>
  findReference(tenantId: string, externalId: string): Promise<{ id: string } | null>
  upsertCandidate(tenantId: string, batchId: string, externalId: string, create: Prisma.PropertyImportCandidateUncheckedCreateInput, update: Prisma.PropertyImportCandidateUncheckedUpdateInput, protectedStates: PropertyImportCandidateState[]): Promise<PropertyImportCandidate>
  findCandidate(tenantId: string, candidateId: string): Promise<PropertyImportCandidate | null>
  findCandidateByExternalId(tenantId: string, batchId: string, externalId: string): Promise<PropertyImportCandidate | null>
  /** Writes only if the candidate is still in `expectedState`; returns null when it changed concurrently. */
  updateCandidateIfState(tenantId: string, candidateId: string, expectedState: PropertyImportCandidateState, data: Prisma.PropertyImportCandidateUncheckedUpdateInput): Promise<PropertyImportCandidate | null>
  listCandidates(tenantId: string, batchId: string): Promise<PropertyImportCandidate[]>
  countCandidates(tenantId: string, batchId: string): Promise<Record<string, number>>
}

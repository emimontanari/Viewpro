import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PERMISSIONS } from '../permissions/permissions.constants'
import type { CurrentUser } from '../auth/types/current-user'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { ActivePropertyCapacityExceededError } from '../property-engagements/active-property-engagement-capacity'
import { PROPERTY_IMPORTS_REPOSITORY, type PropertyImportStagingRepository } from './property-imports.repository'

type ConfirmationOutcome = 'imported' | 'existing' | 'capacity_exceeded' | 'failed' | 'skipped' | 'not_attempted'

@Injectable()
export class ConfirmImportCandidatesUseCase {
  private readonly logger = new Logger(ConfirmImportCandidatesUseCase.name)
  constructor(@Inject(PROPERTY_IMPORTS_REPOSITORY) private readonly repository: PropertyImportStagingRepository) {}
  async execute(tenant: TenantContext, currentUser: CurrentUser, batchId: string) {
    const batch = await this.repository.findBatch(tenant.tenantId, batchId)
    if (!batch) throw new NotFoundException('Property import record not found')
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) throw new ForbiddenException('Insufficient permissions')
    if (!await this.repository.findApprovedClaim(tenant.tenantId, batch.publisherId)) throw new ForbiddenException('This tenant does not have an approved claim for the publisher')
    const rows = await this.repository.listSelectedReady(tenant.tenantId, batchId)
    const outcomes: Array<{ candidateId: string; outcome: ConfirmationOutcome }> = []
    let stopped = false
    for (const row of rows) {
      outcomes.push({ candidateId: row.id, outcome: stopped ? 'not_attempted' : await this.confirmRow(tenant.tenantId, row, currentUser.id) })
      if (outcomes.at(-1)?.outcome === 'capacity_exceeded') stopped = true
    }
    const count = (outcome: ConfirmationOutcome) => outcomes.filter(row => row.outcome === outcome).length
    return { imported: count('imported'), existing: count('existing'), capacityExceeded: count('capacity_exceeded'), failed: count('failed'), skipped: count('skipped'), notAttempted: count('not_attempted'), outcomes }
  }

  // Every write after a rolled-back row transaction is guarded on READY, so a concurrent confirmation's result is never overwritten.
  private async confirmRow(tenantId: string, row: { id: string; externalId: string }, userId: string): Promise<ConfirmationOutcome> {
    try {
      const result = await this.repository.importCandidate(tenantId, row.id, userId)
      if (result.imported) return 'imported'
      if (result.existingReferenceId) {
        await this.repository.markCandidate(tenantId, row.id, 'READY', { state: 'EXISTING', selected: false, resultingReferenceId: result.existingReferenceId, errorReason: null })
        return 'existing'
      }
      // Otherwise a sibling confirmation already took the row.
      return 'skipped'
    } catch (error) {
      if (error instanceof ActivePropertyCapacityExceededError) {
        await this.repository.markCandidate(tenantId, row.id, 'READY', { errorReason: 'plan_limit_reached' })
        return 'capacity_exceeded'
      }
      const reference = (error as { code?: string })?.code === 'P2002' ? await this.repository.findReference(tenantId, row.externalId) : null
      if (reference) {
        await this.repository.markCandidate(tenantId, row.id, 'READY', { state: 'EXISTING', selected: false, resultingReferenceId: reference.id, errorReason: null })
        return 'existing'
      }
      // Store a stable code: raw driver messages can carry internal SQL details and are shown in the UI.
      this.logger.error(`Import of candidate ${row.id} failed`, error instanceof Error ? error.stack : undefined)
      await this.repository.markCandidate(tenantId, row.id, 'READY', { state: 'FAILED', selected: false, errorReason: 'import_failed' })
      return 'failed'
    }
  }
}

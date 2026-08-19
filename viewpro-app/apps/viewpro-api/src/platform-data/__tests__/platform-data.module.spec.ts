import { Test } from '@nestjs/testing'
import { ThrottlerModule } from '@nestjs/throttler'
import { describe, expect, it } from 'vitest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuditLogRepository } from '../audit-log.repository'
import { AuditController } from '../audit.controller'
import { AuditService } from '../audit.service'
import { ChangeFeedClient } from '../change-feed.client'
import { MetricsController } from '../metrics.controller'
import { PlatformDataModule } from '../platform-data.module'
import { PlatformSyncController } from '../platform-sync.controller'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import { TenantDetailController } from '../tenant-detail.controller'
import { TenantDetailService } from '../tenant-detail.service'

/**
 * operator-activity-media (Slice 2a) — DI wiring regression guard, same
 * lesson as apps/api's platform-data.module.spec.ts (see apply-progress
 * #6204: a provider bound in only one of two consuming modules bootstrapped
 * fine locally without Postgres but broke Nest's DI graph under CI). This
 * slice didn't ADD a new module, but it DID add a new constructor dependency
 * (AuditLogRepository) to an already-shared class (TenantDetailService) —
 * exactly the shape of change that caused the Slice 1 bug. `.compile()`
 * never issues a query, so this catches a missing binding without Postgres.
 *
 * audit-view (Slice 1, Phase 1): `AuditService` gained TWO new constructor
 * dependencies — `PlatformTenantRepository` (same module, already provided
 * here) and `OPERATOR_REPOSITORY` (NOT provided by this module directly —
 * it resolves transitively via `PermissionsModule`, imported by AuthModule's
 * sibling `PermissionsModule` import in this module's own `imports` array).
 * `AuditController`/`AuditService` are added to the resolved assertions below
 * so a future change that breaks either injection path fails HERE, without
 * Postgres, instead of surfacing only under the real-DB integration suite or
 * CI e2e boot.
 */
describe('PlatformDataModule (viewpro-api) — DI graph resolves (no live DB required)', () => {
  it('compiles standalone and resolves TenantDetailController/TenantDetailService/AuditLogRepository/ChangeFeedClient/AuditController/AuditService/PlatformTenantRepository', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), DatabaseModule, PlatformDataModule],
    }).compile()

    expect(moduleRef.get(TenantDetailController)).toBeInstanceOf(TenantDetailController)
    expect(moduleRef.get(TenantDetailService)).toBeInstanceOf(TenantDetailService)
    expect(moduleRef.get(AuditLogRepository)).toBeInstanceOf(AuditLogRepository)
    expect(moduleRef.get(ChangeFeedClient)).toBeInstanceOf(ChangeFeedClient)
    expect(moduleRef.get(AuditController)).toBeInstanceOf(AuditController)
    expect(moduleRef.get(AuditService)).toBeInstanceOf(AuditService)
    expect(moduleRef.get(PlatformTenantRepository)).toBeInstanceOf(PlatformTenantRepository)
  })

  // B.3 — old-web/new-API compatibility (#327, Slice B): the additive demand
  // route must resolve alongside the pre-existing GET metrics route so old
  // web (unaware of it) keeps working unchanged once this module deploys.
  it('adds PlatformSyncController alongside the pre-existing MetricsController without displacing it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), DatabaseModule, PlatformDataModule],
    }).compile()

    expect(moduleRef.get(MetricsController)).toBeInstanceOf(MetricsController)
    expect(moduleRef.get(PlatformSyncController)).toBeInstanceOf(PlatformSyncController)
  })
})

import { Test } from '@nestjs/testing'
import { ThrottlerModule } from '@nestjs/throttler'
import { describe, expect, it } from 'vitest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuditLogRepository } from '../audit-log.repository'
import { ChangeFeedClient } from '../change-feed.client'
import { PlatformDataModule } from '../platform-data.module'
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
 */
describe('PlatformDataModule (viewpro-api) — DI graph resolves (no live DB required)', () => {
  it('compiles standalone and resolves TenantDetailController/TenantDetailService/AuditLogRepository/ChangeFeedClient', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), DatabaseModule, PlatformDataModule],
    }).compile()

    expect(moduleRef.get(TenantDetailController)).toBeInstanceOf(TenantDetailController)
    expect(moduleRef.get(TenantDetailService)).toBeInstanceOf(TenantDetailService)
    expect(moduleRef.get(AuditLogRepository)).toBeInstanceOf(AuditLogRepository)
    expect(moduleRef.get(ChangeFeedClient)).toBeInstanceOf(ChangeFeedClient)
  })
})

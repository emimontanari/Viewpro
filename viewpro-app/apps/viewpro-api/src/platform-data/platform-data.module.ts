import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PaymentsModule } from '../payments/payments.module'
import { AuthModule } from '../auth/auth.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { ObservabilityModule } from '../observability/observability.module'
import { ChangeFeedClient } from './change-feed.client'
import { IngestService } from './ingest.service'
import { MirrorRepository } from './mirror.repository'
import { CursorRepository } from './cursor.repository'
import { PlatformTenantRepository } from './platform-tenant.repository'
import { AuditLogRepository } from './audit-log.repository'
import { PlatformSyncCoordinator } from './platform-sync-coordinator'
import { PlatformSyncController } from './platform-sync.controller'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'
import { TenantRegistryService } from './tenant-registry.service'
import { TenantRegistryController } from './tenant-registry.controller'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'
import { TenantDetailService } from './tenant-detail.service'
import { TenantDetailController } from './tenant-detail.controller'

/**
 * PlatformDataModule (viewpro-api) — data-lane consumer module.
 *
 * Wires:
 *  - AuthModule: provides AuthGuard (Phase 4 operator session guard)
 *  - PermissionsModule: provides PlatformPermissionGuard (D4 — operator-platform-roles)
 *  - ChangeFeedClient: mints HS256 ingest tokens and GETs InmoView change-feed
 *  - IngestService: idempotent mirror upsert + cursor advance (D7, D8);
 *    routes each event into the platform_tenants projection by eventType (A8/A9);
 *    routes AUDIT_LOGGED events into platform_audit_log, W2-exempt (A6)
 *  - MirrorRepository: platform_mirror_events CRUD
 *  - CursorRepository: platform_ingest_cursor CRUD
 *  - PlatformTenantRepository: platform_tenants CRUD (A7/A8/A9)
 *  - AuditLogRepository: platform_audit_log append-only CRUD (A8)
 *  - PlatformSyncController: POST /operators/platform-sync/demand — authenticated
 *    demand starts/joins the shared PlatformSyncCoordinator promise and races
 *    it (Slice B, issue #327). Slice D (#327) retired the unconditional
 *    setInterval poll job (D9): idle now performs no feed/cursor/projection
 *    work at all — synchronization runs only through authenticated demand.
 *  - MetricsService: latest-event-wins aggregate from mirror (D6)
 *  - MetricsController: GET /operators/metrics/summary (Phase 4 AuthGuard)
 *  - TenantRegistryService / TenantRegistryController: GET /operators/tenants (A10/A11)
 *  - AuditService / AuditController: GET /operators/audit (A9/A10)
 *  - TenantDetailService / TenantDetailController: GET /operators/tenants/:id/summary —
 *    on-demand passthrough to InmoView's signed internal endpoint, no ViewPro table
 *    read/write (platform-tenant-tracking D8)
 *
 * DatabaseModule is @Global() so PrismaService is available without explicit import.
 */
@Module({
  imports: [PaymentsModule, AuthModule, PermissionsModule, ObservabilityModule],
  controllers: [MetricsController, TenantRegistryController, AuditController, TenantDetailController, PlatformSyncController],
  providers: [
    // ChangeFeedClient's constructor is typed (ConfigService | Options) for a
    // dual DI/unit-test construction mode. A union param emits `Object` under
    // emitDecoratorMetadata, which Nest cannot resolve — so wire it explicitly.
    {
      provide: ChangeFeedClient,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => new ChangeFeedClient(configService),
    },
    MirrorRepository,
    CursorRepository,
    PlatformTenantRepository,
    AuditLogRepository,
    IngestService,
    PlatformSyncCoordinator,
    MetricsService,
    TenantRegistryService,
    AuditService,
    TenantDetailService,
  ],
})
export class PlatformDataModule {}

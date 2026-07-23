import { Module } from '@nestjs/common'
import { PlatformOutboxWriter } from './platform-outbox-writer.js'
import { PrismaOutboxRepository } from './platform-outbox.repository.js'
import { PlatformTenantsReadRepository } from './platform-tenants-read.repository.js'
import { PlatformDataController } from './platform-data.controller.js'
import { PlatformControlGuard } from '../platform-control/platform-control.guard.js'
import { AnalyticsCoreModule } from '../analytics/analytics-core.module.js'
import { GetPilotSummaryUseCase } from '../analytics/use-cases/get-pilot-summary.use-case.js'
import { GetPlatformTenantActivityUseCase } from '../analytics/use-cases/get-platform-tenant-activity.use-case.js'
import { MOVEMENTS_REPOSITORY } from '../movements/movements.repository.js'
import { PrismaMovementsRepository } from '../movements/prisma-movements.repository.js'
import { DOCUMENTS_REPOSITORY } from '../documents/documents.repository.js'
import { PrismaDocumentsRepository } from '../documents/prisma-documents.repository.js'
import { MEMBERSHIP_ACTIVITY_REPOSITORY } from '../memberships/membership-activity.repository.js'
import { PrismaMembershipActivityRepository } from '../memberships/prisma-membership-activity.repository.js'
import { PROPERTY_ASSET_IMAGES_READ_REPOSITORY } from '../property-engagements/property-asset-images-read.repository.js'
import { PrismaPropertyAssetImagesReadRepository } from '../property-engagements/prisma-property-asset-images-read.repository.js'

/**
 * PlatformDataModule — data-lane publisher (read side + outbox writer).
 *
 * Wires:
 *  - PlatformOutboxWriter: inserts outbox rows inside $transaction closures (D3, WU-1)
 *  - PrismaOutboxRepository: read-side query for the change-feed endpoint (D1, WU-2)
 *  - PlatformTenantsReadRepository: read-only tenant registry for GET /internal/platform/tenants (A13, WU-1)
 *  - PlatformDataController: GET /internal/platform/changes + GET /internal/platform/tenants +
 *    GET /internal/platform/tenants/:id/summary (D1, D2, WU-2, platform-tenant-tracking D4)
 *  - PlatformControlGuard: reused by import from platform-control (D2) — NOT merged
 *    into PlatformControlModule; guard is provided here so the controller can use it.
 *  - GetPilotSummaryUseCase / GetPlatformTenantActivityUseCase: provided directly here
 *    (plus their MOVEMENTS_REPOSITORY/DOCUMENTS_REPOSITORY/ANALYTICS_REPOSITORY bindings)
 *    for the tenant-summary route, INSTEAD of importing AnalyticsModule (deviation from
 *    design D5 — discovered during implementation: AuthModule already imports
 *    PlatformDataModule (A4), and AnalyticsModule (transitively, via DocumentsModule/
 *    MovementsModule/TenantContextModule) plainly imports AuthModule — importing
 *    AnalyticsModule here closes a circular ES-module load graph that surfaces as
 *    "Nest cannot create <Module> instance — imports[n] is undefined" at bootstrap,
 *    even with forwardRef (forwardRef only defers Nest's DI-graph resolution of the
 *    *reference*, it cannot prevent Node from eagerly loading the cyclic import chain
 *    of nested `.module.ts` files). AnalyticsCoreModule has zero imports (no AuthModule
 *    edge) so it's safe; PrismaMovementsRepository/PrismaDocumentsRepository are plain
 *    `@Injectable()` Prisma-only classes with no module-level AuthModule dependency, so
 *    providing them directly here duplicates only two stateless bindings — an
 *    acceptable, contained trade-off to avoid a much larger forwardRef blast radius
 *    across TenantContextModule/DocumentsModule/MovementsModule.
 *
 *  - platform-user-activity-capture (D2): GetPlatformTenantActivityUseCase now
 *    also depends on MEMBERSHIP_ACTIVITY_REPOSITORY (3-source merge). The
 *    design doc assumed `MembershipsModule` (which already exports this
 *    token) was reachable via AnalyticsModule — but AnalyticsModule is
 *    NEVER imported here (see the circular-import deviation above), so that
 *    wiring path does not apply to this module's DI graph. Following the
 *    SAME pattern as MOVEMENTS_REPOSITORY/DOCUMENTS_REPOSITORY above,
 *    PrismaMembershipActivityRepository is bound directly: it is a plain
 *    `@Injectable()` Prisma-only class with no module-level AuthModule
 *    dependency (MembershipsModule itself has zero imports), so this
 *    duplicates only one more stateless binding — the identical trade-off
 *    already accepted for the other two repositories.
 *
 *  - operator-activity-media (Slice 1) D2: GetPlatformTenantActivityUseCase
 *    ALSO now depends on PROPERTY_ASSET_IMAGES_READ_REPOSITORY (batched,
 *    N+1-safe property-image lookup for the activity feed). Same direct-
 *    binding pattern as the three repositories above — PrismaProperty
 *    AssetImagesReadRepository is a plain `@Injectable()` Prisma-only class.
 *
 * Design D2: PlatformDataModule is a SIBLING to PlatformControlModule.
 * It reuses PlatformControlGuard by providing it directly — no JwtModule import.
 * The guard reads PLATFORM_CONTROL_SECRET from process.env via verifyServiceToken.
 */
@Module({
  imports: [AnalyticsCoreModule],
  controllers: [PlatformDataController],
  providers: [
    PlatformOutboxWriter,
    PrismaOutboxRepository,
    PlatformTenantsReadRepository,
    PlatformControlGuard,
    { provide: MOVEMENTS_REPOSITORY, useClass: PrismaMovementsRepository },
    { provide: DOCUMENTS_REPOSITORY, useClass: PrismaDocumentsRepository },
    { provide: MEMBERSHIP_ACTIVITY_REPOSITORY, useClass: PrismaMembershipActivityRepository },
    { provide: PROPERTY_ASSET_IMAGES_READ_REPOSITORY, useClass: PrismaPropertyAssetImagesReadRepository },
    GetPilotSummaryUseCase,
    GetPlatformTenantActivityUseCase,
  ],
  exports: [PlatformOutboxWriter],
})
export class PlatformDataModule {}

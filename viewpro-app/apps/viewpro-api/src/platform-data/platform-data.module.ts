import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { ChangeFeedClient } from './change-feed.client'
import { IngestService } from './ingest.service'
import { MirrorRepository } from './mirror.repository'
import { CursorRepository } from './cursor.repository'
import { PlatformTenantRepository } from './platform-tenant.repository'
import { AuditLogRepository } from './audit-log.repository'
import { PlatformDataPollJob } from './platform-data-poll-job'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'
import { TenantRegistryService } from './tenant-registry.service'
import { TenantRegistryController } from './tenant-registry.controller'

/**
 * PlatformDataModule (viewpro-api) — data-lane consumer module.
 *
 * Wires:
 *  - AuthModule: provides AuthGuard (Phase 4 operator session guard)
 *  - ChangeFeedClient: mints HS256 ingest tokens and GETs InmoView change-feed
 *  - IngestService: idempotent mirror upsert + cursor advance (D7, D8);
 *    routes each event into the platform_tenants projection by eventType (A8/A9)
 *  - MirrorRepository: platform_mirror_events CRUD
 *  - CursorRepository: platform_ingest_cursor CRUD
 *  - PlatformTenantRepository: platform_tenants CRUD (A7/A8/A9)
 *  - PlatformDataPollJob: setInterval-based poll loop with overlap guard (D9)
 *  - MetricsService: latest-event-wins aggregate from mirror (D6)
 *  - MetricsController: GET /operators/metrics/summary (Phase 4 AuthGuard)
 *  - TenantRegistryService / TenantRegistryController: GET /operators/tenants (A10/A11)
 *
 * DatabaseModule is @Global() so PrismaService is available without explicit import.
 */
@Module({
  imports: [AuthModule],
  controllers: [MetricsController, TenantRegistryController],
  providers: [
    ChangeFeedClient,
    MirrorRepository,
    CursorRepository,
    PlatformTenantRepository,
    AuditLogRepository,
    IngestService,
    {
      provide: PlatformDataPollJob,
      inject: [ChangeFeedClient, IngestService, CursorRepository, ConfigService],
      useFactory: (
        feedClient: ChangeFeedClient,
        ingestService: IngestService,
        cursorRepo: CursorRepository,
        configService: ConfigService,
      ) => {
        const pollIntervalMs = configService.get<number>('app.platformData.pollIntervalMs', 5000)
        return new PlatformDataPollJob(feedClient, ingestService, cursorRepo, pollIntervalMs)
      },
    },
    MetricsService,
    TenantRegistryService,
  ],
})
export class PlatformDataModule {}

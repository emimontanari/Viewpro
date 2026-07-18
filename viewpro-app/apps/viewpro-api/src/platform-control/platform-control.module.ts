import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { PlatformTenantRepository } from '../platform-data/platform-tenant.repository'
import { PlatformControlClient } from './platform-control.client'
import { PlatformControlController } from './platform-control.controller'

/**
 * PlatformControlModule (viewpro-api) — outbound control-lane module.
 *
 * Wires:
 *  - AuthModule: provides AuthGuard (Phase 4 operator session guard)
 *  - PermissionsModule: provides PlatformPermissionGuard (D4 — operator-platform-roles)
 *  - PlatformControlClient: mints HS256 service tokens and POSTs to InmoView
 *  - PlatformTenantRepository: platform-manual-plans (Slice 4, Part 2) —
 *    provided directly here (not imported via PlatformDataModule) so the
 *    outbound control lane does NOT pull in the inbound ingest/polling
 *    infrastructure (ChangeFeedClient, PlatformDataPollJob's OnModuleInit
 *    autostart). It is a stateless, PrismaService-only repository — safe to
 *    provide in both modules (DatabaseModule is @Global()).
 *  - PlatformControlController: PATCH /operators/tenants/:id/{status,limits,plan}
 *
 * PlatformControlClient uses ConfigService for PLATFORM_CONTROL_SECRET and
 * INMOVIEW_API_INTERNAL_URL — both required at startup (validated by env schema).
 */
@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [PlatformControlController],
  // PlatformControlClient's constructor is typed (ConfigService | Options) for a
  // dual DI/unit-test construction mode. A union param emits `Object` under
  // emitDecoratorMetadata, which Nest cannot resolve — so wire it explicitly.
  providers: [
    {
      provide: PlatformControlClient,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => new PlatformControlClient(configService),
    },
    PlatformTenantRepository,
  ],
})
export class PlatformControlModule {}

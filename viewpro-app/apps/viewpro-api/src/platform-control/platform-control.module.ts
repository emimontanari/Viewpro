import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { PlatformControlClient } from './platform-control.client'
import { PlatformControlController } from './platform-control.controller'

/**
 * PlatformControlModule (viewpro-api) — outbound control-lane module.
 *
 * Wires:
 *  - AuthModule: provides AuthGuard (Phase 4 operator session guard)
 *  - PermissionsModule: provides PlatformPermissionGuard (D4 — operator-platform-roles)
 *  - PlatformControlClient: mints HS256 service tokens and POSTs to InmoView
 *  - PlatformControlController: PATCH /operators/tenants/:id/{status,limits}
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
  ],
})
export class PlatformControlModule {}

import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PlatformControlClient } from './platform-control.client'
import { PlatformControlController } from './platform-control.controller'

/**
 * PlatformControlModule (viewpro-api) — outbound control-lane module.
 *
 * Wires:
 *  - AuthModule: provides AuthGuard (Phase 4 operator session guard)
 *  - PlatformControlClient: mints HS256 service tokens and POSTs to InmoView
 *  - PlatformControlController: PATCH /operators/tenants/:id/{status,limits}
 *
 * PlatformControlClient uses ConfigService for PLATFORM_CONTROL_SECRET and
 * INMOVIEW_API_INTERNAL_URL — both required at startup (validated by env schema).
 */
@Module({
  imports: [AuthModule],
  controllers: [PlatformControlController],
  providers: [PlatformControlClient],
})
export class PlatformControlModule {}

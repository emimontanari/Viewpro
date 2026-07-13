import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { PlatformControlController } from './platform-control.controller'
import { PlatformControlGuard } from './platform-control.guard'

/**
 * PlatformControlModule — inbound control-lane endpoints for apps/api.
 *
 * Wires:
 *  - PlatformControlGuard: verifies HS256 service JWT (PLATFORM_CONTROL_SECRET)
 *  - PlatformControlController: POST /internal/platform/tenants/:id/{status,limits}
 *
 * Idempotency is handled via a single Prisma transaction in PlatformControlController,
 * using PrismaService (provided globally by DatabaseModule) directly — no separate
 * idempotency repository needed.
 *
 * Imports AdminModule to reuse AdminTenantStatusService + AdminTenantLimitsService.
 * Does NOT import or share JwtModule with AuthModule — trust paths are fully isolated.
 *
 * Note: PlatformControlGuard reads PLATFORM_CONTROL_SECRET directly from process.env
 * (via the standalone verifyServiceToken helper) to avoid a JwtModule import that
 * could shadow the product-wide AuthModule's JwtModule.
 */
@Module({
  imports: [AdminModule],
  controllers: [PlatformControlController],
  providers: [PlatformControlGuard],
})
export class PlatformControlModule {}

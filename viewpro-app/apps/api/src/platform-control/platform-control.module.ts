import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { IDEMPOTENCY_REPOSITORY } from './idempotency.repository'
import { PlatformControlController } from './platform-control.controller'
import { PlatformControlGuard } from './platform-control.guard'
import { PrismaIdempotencyRepository } from './prisma-idempotency.repository'

/**
 * PlatformControlModule — inbound control-lane endpoints for apps/api.
 *
 * Wires:
 *  - PlatformControlGuard: verifies HS256 service JWT (PLATFORM_CONTROL_SECRET)
 *  - PlatformControlController: POST /internal/platform/tenants/:id/{status,limits}
 *  - PrismaIdempotencyRepository: insert-first idempotency via platform_command_log
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
  providers: [
    PlatformControlGuard,
    {
      provide: IDEMPOTENCY_REPOSITORY,
      useClass: PrismaIdempotencyRepository,
    },
  ],
})
export class PlatformControlModule {}

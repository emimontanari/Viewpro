import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { AuditLogRepository } from '../platform-data/audit-log.repository'
import { PlatformTenantRepository } from '../platform-data/platform-tenant.repository'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PrismaPaymentRepository } from './prisma-payment.repository'

/**
 * PaymentsModule (viewpro-api) — the manual-billing money ledger.
 *
 * Wires:
 *  - AuthModule: AuthGuard (operator session) and StepUpGuard (money mutations)
 *  - PermissionsModule: PlatformPermissionGuard (PAYMENTS_READ/WRITE/REVERSE)
 *  - PrismaPaymentRepository: the append-only ledger
 *  - AuditLogRepository: native audit rows, written inside the same transaction
 *  - PlatformTenantRepository: existence check behind the 404
 *
 * AuditLogRepository and PlatformTenantRepository are provided directly rather
 * than by importing PlatformDataModule, for the same reason PlatformControlModule
 * does it: importing that module would drag in the inbound ingest/polling
 * infrastructure and its OnModuleInit autostart. Both are stateless
 * PrismaService-only repositories, and DatabaseModule is @Global().
 */
@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaPaymentRepository, AuditLogRepository, PlatformTenantRepository],
  exports: [PaymentsService, PrismaPaymentRepository],
})
export class PaymentsModule {}

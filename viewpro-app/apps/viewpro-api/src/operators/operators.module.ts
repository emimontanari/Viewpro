import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { Argon2PasswordHasher } from '../auth/security/argon2-password-hasher'
import { PASSWORD_HASHER } from '../auth/security/password-hasher'
import { PermissionsModule } from '../permissions/permissions.module'
import { AuditLogRepository } from '../platform-data/audit-log.repository'
import { OperatorsController } from './operators.controller'
import { CreateOperatorUseCase } from './use-cases/create-operator.use-case'
import { ListOperatorsUseCase } from './use-cases/list-operators.use-case'
import { ChangeRoleOperatorUseCase } from './use-cases/change-role-operator.use-case'
import { ChangeStatusOperatorUseCase } from './use-cases/change-status-operator.use-case'

/**
 * OperatorsModule (viewpro-api) — OWNER-only operator-roster management
 * (platform-operator-management, A4).
 *
 * Wires:
 *  - AuthModule: provides AuthGuard/StepUpGuard (Phase 4 session + step-up)
 *  - PermissionsModule: provides PlatformPermissionGuard + OPERATOR_REPOSITORY
 *    (D4 — operator-platform-roles)
 *  - PASSWORD_HASHER: bound directly here (Argon2PasswordHasher is stateless
 *    — safe to provide again, same rationale as PlatformTenantRepository in
 *    platform-control.module.ts) so operator creation NEVER falls back to a
 *    direct argon2 call (unlike prisma/seed.ts, which is out of DI scope).
 *  - AuditLogRepository: provided directly (PrismaService-only, stateless) —
 *    NOT via PlatformDataModule, so this module does not pull in the
 *    ingest/polling infrastructure (ChangeFeedClient, PlatformDataPollJob's
 *    OnModuleInit autostart), mirroring PlatformControlModule's isolation.
 *  - OperatorsController: POST/GET/PATCH operators/manage/*
 *
 * DatabaseModule is @Global() so PrismaService is available without explicit import.
 */
@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [OperatorsController],
  providers: [
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    AuditLogRepository,
    CreateOperatorUseCase,
    ListOperatorsUseCase,
    ChangeRoleOperatorUseCase,
    ChangeStatusOperatorUseCase,
  ],
})
export class OperatorsModule {}

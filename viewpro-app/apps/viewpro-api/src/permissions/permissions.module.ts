import { Module } from '@nestjs/common'
import { OPERATOR_REPOSITORY } from '../auth/repositories/operator.repository'
import { PrismaOperatorRepository } from '../auth/repositories/prisma-operator.repository'
import { PlatformPermissionGuard } from './platform-permission.guard'

/**
 * PermissionsModule (viewpro-api) — self-contained: binds its own
 * `OPERATOR_REPOSITORY` (reusing the existing `PrismaOperatorRepository`),
 * so no new `AuthModule` export surface is needed (D8).
 */
@Module({
  providers: [
    PlatformPermissionGuard,
    { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
  ],
  exports: [PlatformPermissionGuard],
})
export class PermissionsModule {}

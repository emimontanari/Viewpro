import { IsIn } from 'class-validator'
import type { PlatformOperatorRole } from '@prisma-platform/client'

const OPERATOR_ROLES: readonly PlatformOperatorRole[] = ['OWNER', 'OPERATIONS', 'ANALYST']

export class UpdateRoleOperatorDto {
  @IsIn(OPERATOR_ROLES)
  role!: PlatformOperatorRole
}

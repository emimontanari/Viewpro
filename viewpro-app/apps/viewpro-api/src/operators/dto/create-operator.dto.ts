import { IsEmail, IsIn, MinLength } from 'class-validator'
import type { PlatformOperatorRole } from '@prisma-platform/client'

const OPERATOR_ROLES: readonly PlatformOperatorRole[] = ['OWNER', 'OPERATIONS', 'ANALYST']

export class CreateOperatorDto {
  @IsEmail()
  email!: string

  @IsIn(OPERATOR_ROLES)
  role!: PlatformOperatorRole

  // Design Decision 5: OWNER-provided password, min length 12, no forced rotation.
  @MinLength(12)
  tempPassword!: string
}

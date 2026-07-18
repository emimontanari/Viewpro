import { IsIn } from 'class-validator'
import type { OperatorStatus } from '@prisma-platform/client'

const OPERATOR_STATUSES: readonly OperatorStatus[] = ['ACTIVE', 'SUSPENDED']

export class UpdateStatusOperatorDto {
  @IsIn(OPERATOR_STATUSES)
  status!: OperatorStatus
}

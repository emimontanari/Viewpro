import type { Operator, OperatorStatus, PlatformOperatorRole, Prisma } from '@prisma-platform/client'

export const OPERATOR_REPOSITORY = Symbol('OPERATOR_REPOSITORY')

/** Safe-to-return operator shape — NEVER includes passwordHash. */
export type OperatorSummary = Omit<Operator, 'passwordHash'>

export type IOperatorRepository = {
  findByEmail(email: string): Promise<Operator | null>
  findById(id: string): Promise<Operator | null>
  create(input: { email: string; passwordHash: string; role: PlatformOperatorRole }): Promise<OperatorSummary>
  list(): Promise<OperatorSummary[]>
  updateRole(id: string, role: PlatformOperatorRole, tx?: Prisma.TransactionClient): Promise<OperatorSummary>
  updateStatus(id: string, status: OperatorStatus, tx?: Prisma.TransactionClient): Promise<OperatorSummary>
  countActiveOwners(excludeId: string, tx?: Prisma.TransactionClient): Promise<number>
}

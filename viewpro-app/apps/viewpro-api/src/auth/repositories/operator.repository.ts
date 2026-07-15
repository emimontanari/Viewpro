import type { Operator } from '@prisma-platform/client'

export const OPERATOR_REPOSITORY = Symbol('OPERATOR_REPOSITORY')

export type IOperatorRepository = {
  findByEmail(email: string): Promise<Operator | null>
  findById(id: string): Promise<Operator | null>
}

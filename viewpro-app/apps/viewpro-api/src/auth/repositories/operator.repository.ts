import type { Operator } from '@prisma/client'

export const OPERATOR_REPOSITORY = Symbol('OPERATOR_REPOSITORY')

export type IOperatorRepository = {
  findByEmail(email: string): Promise<Operator | null>
}

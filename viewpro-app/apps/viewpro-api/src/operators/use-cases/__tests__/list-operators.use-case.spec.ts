import { describe, it, expect, vi } from 'vitest'
import { ListOperatorsUseCase } from '../list-operators.use-case'
import type { IOperatorRepository } from '../../../auth/repositories/operator.repository'

/**
 * T1.3.3 — RED: `ListOperatorsUseCase` — returns `OperatorSummary[]`, no
 * passwordHash.
 */
describe('ListOperatorsUseCase (T1.3.3)', () => {
  it('returns the repository list result unchanged, with no passwordHash on any item', async () => {
    const operators = [
      { id: 'op-1', email: 'a@viewpro.app', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'op-2', email: 'b@viewpro.app', role: 'ANALYST', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ]
    const operatorRepository: IOperatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      list: vi.fn().mockResolvedValue(operators),
      updateRole: vi.fn(),
      updateStatus: vi.fn(),
      countActiveOwners: vi.fn(),
    }

    const useCase = new ListOperatorsUseCase(operatorRepository)
    const result = await useCase.execute()

    expect(result).toEqual(operators)
    for (const op of result) {
      expect(op).not.toHaveProperty('passwordHash')
    }
  })
})

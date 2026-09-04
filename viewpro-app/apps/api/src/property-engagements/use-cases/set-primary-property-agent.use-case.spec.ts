import { describe, expect, it, vi } from 'vitest'
import { SetPrimaryPropertyAgentUseCase } from './set-primary-property-agent.use-case'

describe('SetPrimaryPropertyAgentUseCase primary compatibility', () => {
  it('delegates only explicit set and change commands with their compare-and-set state', async () => {
    const repository = {
      setPrimaryAgent: vi.fn().mockResolvedValue({ status: 'engagementNotFound' }),
    }
    const useCase = new SetPrimaryPropertyAgentUseCase(repository as never)
    const tenant = { tenantId: 'tenant-1' } as never

    await expect(
      useCase.execute(tenant, 'engagement-1', {
        agentId: 'agent-a',
        expectedPrimaryAgentId: null,
      }),
    ).rejects.toThrow('Property engagement not found')
    await expect(
      useCase.execute(tenant, 'engagement-1', {
        agentId: 'agent-b',
        expectedPrimaryAgentId: 'agent-a',
      }),
    ).rejects.toThrow('Property engagement not found')

    expect(repository.setPrimaryAgent).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-1',
      engagementId: 'engagement-1',
      agentId: 'agent-a',
      expectedPrimaryAgentId: null,
    })
    expect(repository.setPrimaryAgent).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-1',
      engagementId: 'engagement-1',
      agentId: 'agent-b',
      expectedPrimaryAgentId: 'agent-a',
    })
  })
})

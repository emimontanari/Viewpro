import { describe, it, expect, vi } from 'vitest'
import { PlatformDataController } from '../platform-data.controller'

/**
 * platform-tenant-tracking (PR1) — JD FIX 2 (RED): the summary route must cap
 * the activity `limit` so an authenticated caller cannot request a huge page
 * size and drive an unbounded Prisma query (DoS). The controller sanitizer
 * enforced only a floor (>= 1) with no ceiling.
 *
 * Pure unit test (no Nest app / DB): asserts the value forwarded to
 * GetPlatformTenantActivityUseCase is clamped to the MAX (100).
 */

function makeController(overrides?: {
  activityExecute?: ReturnType<typeof vi.fn>
}) {
  const outboxRepository = {} as never
  const tenantsReadRepository = {
    findById: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
    findAll: vi.fn(),
  } as never
  const getPilotSummaryUseCase = {
    execute: vi.fn().mockResolvedValue({
      window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
      activeEngagements: 0,
      activeEngagementsWithOwnerVisibleUpdate: 0,
      activeEngagementUpdatePercentage: 0,
      documentEvents: { requested: 0, uploaded: 0, approved: 0, rejected: 0 },
      ownerViewedPropertyCount: 0,
    }),
  } as never
  const activityExecute =
    overrides?.activityExecute ?? vi.fn().mockResolvedValue({ total: 0, items: [] })
  const getPlatformTenantActivityUseCase = { execute: activityExecute } as never
  const createPlatformDocumentReadUrlUseCase = { execute: vi.fn() } as never

  const controller = new PlatformDataController(
    outboxRepository,
    tenantsReadRepository,
    getPilotSummaryUseCase,
    getPlatformTenantActivityUseCase,
    createPlatformDocumentReadUrlUseCase,
  )

  return { controller, activityExecute }
}

describe('PlatformDataController — summary activity limit cap (JD FIX 2)', () => {
  it('clamps an over-max limit down to 100 before invoking the activity use-case', async () => {
    const { controller, activityExecute } = makeController()

    await controller.getTenantSummary('tenant-1', '0', '100000000')

    expect(activityExecute).toHaveBeenCalledWith({ tenantId: 'tenant-1', offset: 0, limit: 100 })
  })

  it('leaves an in-range limit untouched', async () => {
    const { controller, activityExecute } = makeController()

    await controller.getTenantSummary('tenant-1', '0', '25')

    expect(activityExecute).toHaveBeenCalledWith({ tenantId: 'tenant-1', offset: 0, limit: 25 })
  })
})

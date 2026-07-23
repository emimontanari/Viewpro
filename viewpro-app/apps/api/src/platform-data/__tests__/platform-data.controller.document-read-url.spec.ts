import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { PlatformDataController } from '../platform-data.controller'

/**
 * operator-activity-media (Slice 2a) — RED: GET
 * /internal/platform/tenants/:tenantId/document-versions/:versionId/read-url
 *
 * Pure unit test (no Nest app / DB — mirrors
 * platform-data.controller.summary-limit.spec.ts's pattern): asserts the
 * route forwards path params to CreatePlatformDocumentReadUrlUseCase in
 * (tenantId, versionId) order, returns its result verbatim, and propagates a
 * thrown NotFoundException (design D6 — cross-tenant/missing → 404, not
 * swallowed/remapped by the controller).
 *
 * Guard application (`@UseGuards(PlatformControlGuard)`, class-level, no new
 * wiring) and full HTTP-layer behavior are covered by the class-level e2e
 * suite in platform-data.controller.spec.ts (requires a live Postgres test
 * DB — CI-gated, not exercised by this file).
 */
function makeController(overrides?: { execute?: ReturnType<typeof vi.fn> }) {
  const outboxRepository = {} as never
  const tenantsReadRepository = {} as never
  const getPilotSummaryUseCase = {} as never
  const getPlatformTenantActivityUseCase = {} as never
  const execute = overrides?.execute ?? vi.fn()
  const createPlatformDocumentReadUrlUseCase = { execute } as never

  const controller = new PlatformDataController(
    outboxRepository,
    tenantsReadRepository,
    getPilotSummaryUseCase,
    getPlatformTenantActivityUseCase,
    createPlatformDocumentReadUrlUseCase,
  )

  return { controller, execute }
}

describe('PlatformDataController.getDocumentReadUrl (Slice 2a)', () => {
  it('forwards tenantId and versionId path params to the use case in order', async () => {
    const execute = vi.fn().mockResolvedValue({
      url: 'https://storage.example/read',
      expiresInSeconds: 300,
      originalFilename: 'deed.pdf',
      mimeType: 'application/pdf',
    })
    const { controller } = makeController({ execute })

    await controller.getDocumentReadUrl('tenant-1', 'version-1')

    expect(execute).toHaveBeenCalledWith('tenant-1', 'version-1')
  })

  it('returns the use case result verbatim on success', async () => {
    const result = {
      url: 'https://storage.example/read',
      expiresInSeconds: 300,
      originalFilename: 'deed.pdf',
      mimeType: 'application/pdf',
    }
    const execute = vi.fn().mockResolvedValue(result)
    const { controller } = makeController({ execute })

    await expect(controller.getDocumentReadUrl('tenant-1', 'version-1')).resolves.toBe(result)
  })

  it('propagates a NotFoundException thrown by the use case (cross-tenant/missing → 404, D6)', async () => {
    const execute = vi.fn().mockRejectedValue(new NotFoundException('Document version not found'))
    const { controller } = makeController({ execute })

    await expect(
      controller.getDocumentReadUrl('tenant-1', 'version-owned-by-tenant-2'),
    ).rejects.toThrow(new NotFoundException('Document version not found'))
  })
})

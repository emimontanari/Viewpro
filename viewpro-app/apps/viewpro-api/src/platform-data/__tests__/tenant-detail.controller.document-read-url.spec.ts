import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard'
import { TenantDetailController } from '../tenant-detail.controller'
import type { TenantDetailService } from '../tenant-detail.service'

/**
 * operator-activity-media (Slice 2a) — RED: TenantDetailController.documentReadUrl
 * route wiring.
 *
 * Pure unit test (no Nest app / DB — mirrors apps/api's
 * platform-data.controller.document-read-url.spec.ts pattern): asserts the
 * route forwards (tenantId, versionId, actor) to TenantDetailService in
 * order, actor coming from `request.user` (populated by AuthGuard, class-
 * level, unchanged — no new guard wiring here).
 *
 * Guard application (@RequirePlatformPermission(TENANT_DOCUMENTS_READ), not
 * yet seeded to any role) and full HTTP-layer behavior are covered by the
 * class-level e2e suite in tenant-detail.controller.spec.ts (requires a live
 * Postgres test DB — CI-gated, not exercised by this file).
 */
function makeRequest(user?: { id: string; email: string }): AuthenticatedRequest {
  return { user } as AuthenticatedRequest
}

describe('TenantDetailController.documentReadUrl (Slice 2a)', () => {
  it('forwards tenantId, versionId, and the authenticated operator (request.user) to the service', async () => {
    const getDocumentReadUrl = vi.fn().mockResolvedValue({
      url: 'https://storage.example/read',
      expiresInSeconds: 300,
      originalFilename: 'deed.pdf',
      mimeType: 'application/pdf',
    })
    const service = { getDocumentReadUrl } as unknown as TenantDetailService
    const controller = new TenantDetailController(service)
    const request = makeRequest({ id: 'operator-1', email: 'operator@viewpro.app' })

    await controller.documentReadUrl('tenant-1', 'version-1', request)

    expect(getDocumentReadUrl).toHaveBeenCalledWith('tenant-1', 'version-1', {
      id: 'operator-1',
      email: 'operator@viewpro.app',
    })
  })

  it('returns the service result verbatim on success', async () => {
    const result = {
      url: 'https://storage.example/read',
      expiresInSeconds: 300,
      originalFilename: 'deed.pdf',
      mimeType: 'application/pdf',
    }
    const getDocumentReadUrl = vi.fn().mockResolvedValue(result)
    const service = { getDocumentReadUrl } as unknown as TenantDetailService
    const controller = new TenantDetailController(service)

    await expect(
      controller.documentReadUrl('tenant-1', 'version-1', makeRequest({ id: 'operator-1', email: 'op@viewpro.app' })),
    ).resolves.toBe(result)
  })

  it('propagates any exception thrown by the service (404/502 mapping lives in TenantDetailService)', async () => {
    const getDocumentReadUrl = vi.fn().mockRejectedValue(new Error('boom'))
    const service = { getDocumentReadUrl } as unknown as TenantDetailService
    const controller = new TenantDetailController(service)

    await expect(
      controller.documentReadUrl('tenant-1', 'version-1', makeRequest({ id: 'operator-1', email: 'op@viewpro.app' })),
    ).rejects.toThrow('boom')
  })
})

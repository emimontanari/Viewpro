import { BadGatewayException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ChangeFeedClient, DocumentReadUrlFetchError } from '../change-feed.client'
import { AuditLogRepository } from '../audit-log.repository'
import { TenantDetailService } from '../tenant-detail.service'

/**
 * operator-activity-media (Slice 2a) — RED: TenantDetailService.getDocumentReadUrl
 * fail-closed ordering (D7, spec: operator-document-read — "Audit Entry on
 * Every Successful Mint" / "Audit write fails").
 *
 * Pure unit test (no Nest app / DB): ChangeFeedClient and AuditLogRepository
 * are both mocked, so the exact call ORDER (mint → audit → return) and the
 * fail-closed branch (audit throws → 5xx, URL withheld) can be asserted
 * deterministically without a live Postgres connection.
 */
function makeService(overrides?: {
  fetchDocumentReadUrl?: ReturnType<typeof vi.fn>
  appendNative?: ReturnType<typeof vi.fn>
}) {
  const fetchDocumentReadUrl = overrides?.fetchDocumentReadUrl ?? vi.fn()
  const appendNative = overrides?.appendNative ?? vi.fn().mockResolvedValue(undefined)
  const changeFeedClient = { fetchDocumentReadUrl } as unknown as ChangeFeedClient
  const auditLogRepository = { appendNative } as unknown as AuditLogRepository

  const service = new TenantDetailService(changeFeedClient, auditLogRepository)

  return { service, fetchDocumentReadUrl, appendNative }
}

const actor = { id: 'operator-1', email: 'operator@viewpro.app' }
const mintedResult = {
  url: 'https://storage.example/read/documents/req-1/version-1.pdf',
  expiresInSeconds: 300,
  originalFilename: 'deed.pdf',
  mimeType: 'application/pdf',
}

describe('TenantDetailService.getDocumentReadUrl (Slice 2a — fail-closed audit)', () => {
  it('successful mint: writes ONE TENANT_DOCUMENT_VIEWED audit row BEFORE returning the URL, mint happens before audit', async () => {
    const callOrder: string[] = []
    const fetchDocumentReadUrl = vi.fn().mockImplementation(async () => {
      callOrder.push('mint')
      return mintedResult
    })
    const appendNative = vi.fn().mockImplementation(async () => {
      callOrder.push('audit')
    })
    const { service } = makeService({ fetchDocumentReadUrl, appendNative })

    const result = await service.getDocumentReadUrl('tenant-1', 'version-1', actor)

    expect(result).toEqual(mintedResult)
    expect(callOrder).toEqual(['mint', 'audit'])
    expect(appendNative).toHaveBeenCalledWith({
      action: 'TENANT_DOCUMENT_VIEWED',
      actor,
      target: { documentVersionId: 'version-1', filename: 'deed.pdf' },
      tenantId: 'tenant-1',
    })
  })

  it('audit write fails: returns a server error (5xx), does NOT return the URL, mint was still attempted', async () => {
    const fetchDocumentReadUrl = vi.fn().mockResolvedValue(mintedResult)
    const appendNative = vi.fn().mockRejectedValue(new Error('audit db unavailable'))
    const { service } = makeService({ fetchDocumentReadUrl, appendNative })

    await expect(service.getDocumentReadUrl('tenant-1', 'version-1', actor)).rejects.toBeInstanceOf(
      BadGatewayException,
    )
    expect(fetchDocumentReadUrl).toHaveBeenCalledOnce()
  })

  it('cross-tenant/missing version (InmoView 404): maps to NotFoundException, NO audit write attempted', async () => {
    const fetchDocumentReadUrl = vi
      .fn()
      .mockRejectedValue(new DocumentReadUrlFetchError('not found', 404))
    const appendNative = vi.fn()
    const { service } = makeService({ fetchDocumentReadUrl, appendNative })

    await expect(service.getDocumentReadUrl('tenant-1', 'does-not-exist', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(appendNative).not.toHaveBeenCalled()
  })

  it('InmoView unreachable/non-404 error: maps to BadGatewayException, NO audit write attempted', async () => {
    const fetchDocumentReadUrl = vi.fn().mockRejectedValue(new DocumentReadUrlFetchError('network down'))
    const appendNative = vi.fn()
    const { service } = makeService({ fetchDocumentReadUrl, appendNative })

    await expect(service.getDocumentReadUrl('tenant-1', 'version-1', actor)).rejects.toBeInstanceOf(
      BadGatewayException,
    )
    expect(appendNative).not.toHaveBeenCalled()
  })

  it('expired-URL re-fetch: a second call mints AND audits again (fresh TTL, new independent audit entry)', async () => {
    const fetchDocumentReadUrl = vi.fn().mockResolvedValue(mintedResult)
    const appendNative = vi.fn().mockResolvedValue(undefined)
    const { service } = makeService({ fetchDocumentReadUrl, appendNative })

    await service.getDocumentReadUrl('tenant-1', 'version-1', actor)
    await service.getDocumentReadUrl('tenant-1', 'version-1', actor)

    expect(fetchDocumentReadUrl).toHaveBeenCalledTimes(2)
    expect(appendNative).toHaveBeenCalledTimes(2)
  })
})

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import type {
  ChangeFeedResponse,
  PlatformTenantRegistryLimits,
  PlatformTenantStatus,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * Item shape returned by InmoView's GET /internal/platform/tenants (A13) —
 * mirrors apps/api's PlatformTenantsReadRepository.TenantRegistryItem.
 */
export type BackfillTenantItem = {
  id: string
  name: string
  slug: string
  status: PlatformTenantStatus
  limits: PlatformTenantRegistryLimits
}

export type TenantsBackfillResponse = {
  tenants: BackfillTenantItem[]
}

/**
 * One item of the merged activity feed returned by InmoView's tenant-summary
 * endpoint. Mirrors `ActivityFeedItemResponse` shape-wise but is intentionally
 * kept loose here (FE-owned mirrored types per design D6 — no shared
 * `packages/platform-contract` type for this wire shape).
 */
export type PlatformActivityFeedItem = {
  kind: 'movement' | 'document_request'
  id: string
  createdAt: string
  [key: string]: unknown
}

/**
 * Response shape for GET .../document-versions/:versionId/read-url — mirrors
 * apps/api's `PlatformDocumentReadUrlResponse` 1:1 (design D5/D6). Flat
 * shape, distinct from the tenant-summary passthrough above.
 */
export type PlatformDocumentReadUrlResponse = {
  url: string
  expiresInSeconds: number
  originalFilename: string
  mimeType: string
}

/**
 * Typed error thrown by `fetchDocumentReadUrl`. Mirrors `TenantSummaryFetchError`
 * (D8 pattern): carries the upstream HTTP status when available so the caller
 * (the new document-read handler) can map InmoView's 404 (cross-tenant/missing
 * version, D6) to a ViewPro 404 and everything else to a 502 — WITHOUT ever
 * minting a URL or writing an audit row on the 404 path (spec: "Missing or
 * deleted document version" → no audit entry).
 */
export class DocumentReadUrlFetchError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'DocumentReadUrlFetchError'
    this.status = status
  }
}

/**
 * Response shape for GET /internal/platform/tenants/:id/summary — mirrors
 * apps/api's `PlatformTenantSummaryResponse` 1:1 (design D6).
 */
export type PlatformTenantSummaryResponse = {
  window: { from: string; to: string }
  activeEngagements: number
  activeEngagementsWithOwnerVisibleUpdate: number
  activeEngagementUpdatePercentage: number
  documentEvents: {
    requested: number
    uploaded: number
    approved: number
    rejected: number
  }
  ownerViewedPropertyCount: number
  activity: {
    total: number
    items: PlatformActivityFeedItem[]
  }
}

/**
 * Typed error thrown by `fetchTenantSummary`. Carries the upstream HTTP
 * status (when available) so callers (TenantDetailService) can map InmoView's
 * 404 to a ViewPro 404 and everything else (other non-2xx, or InmoView being
 * unreachable — `status` absent) to a 502 (design D8).
 */
export class TenantSummaryFetchError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TenantSummaryFetchError'
    this.status = status
  }
}

/**
 * Options for constructing ChangeFeedClient directly (unit-testable).
 */
export interface ChangeFeedClientOptions {
  inmoviewApiInternalUrl: string
  platformControlSecret: string
}

/**
 * ChangeFeedClient — inbound side of the platform data lane.
 *
 * Mints a short-lived HS256 service token per request and GETs the
 * InmoView change-feed endpoint to poll for new outbox events.
 *
 * Security invariants:
 * - Signed with PLATFORM_CONTROL_SECRET (NOT ACCESS_TOKEN_SECRET).
 * - Token is NEVER logged or persisted.
 * - sub is a fixed system principal ('system-ingest') — no operator identity.
 */
@Injectable()
export class ChangeFeedClient {
  private readonly inmoviewApiInternalUrl: string
  private readonly jwtService: JwtService

  /**
   * Supports two construction modes:
   *  1. NestJS DI: pass (ConfigService) — used at runtime.
   *  2. Direct construction: pass (ChangeFeedClientOptions) — used in unit tests.
   */
  constructor(configOrOptions: ConfigService | ChangeFeedClientOptions) {
    if (configOrOptions instanceof ConfigService) {
      const configService = configOrOptions
      this.inmoviewApiInternalUrl = configService.getOrThrow<string>(
        'app.platformControl.inmoviewApiInternalUrl',
      )
      const secret = configService.getOrThrow<string>('app.platformControl.secret')
      this.jwtService = new JwtService({ secret })
    } else {
      this.inmoviewApiInternalUrl = configOrOptions.inmoviewApiInternalUrl
      this.jwtService = new JwtService({ secret: configOrOptions.platformControlSecret })
    }
  }

  /**
   * Mint a short-lived HS256 service token for the ingest system.
   *
   * Claims:
   *  - iss: 'viewpro-api'
   *  - aud: 'inmoview-control'
   *  - sub: 'system-ingest' (fixed system principal for the poll job)
   *  - jti: crypto.randomUUID() — unique token ID, populates PlatformServiceIdentity.tokenId (S1)
   *  - exp: now + 120s
   */
  private mintIngestToken(): string {
    return this.jwtService.sign(
      {
        iss: 'viewpro-api',
        aud: 'inmoview-control',
        // S1: jti makes each token unique so PlatformServiceIdentity.tokenId is populated
        // and token replay can be detected. Using crypto.randomUUID() for collision resistance.
        jti: randomUUID(),
      },
      {
        subject: 'system-ingest',
        expiresIn: 120,
      },
    )
  }

  /**
   * GET /api/internal/platform/changes?since=<cursor>
   *
   * Fetches the next batch of outbox events from InmoView.
   * Returns the parsed ChangeFeedResponse on 2xx, or throws on non-2xx.
   */
  async fetchChanges(since: number): Promise<ChangeFeedResponse> {
    const baseUrl = this.trimTrailingSlash(this.inmoviewApiInternalUrl)
    const url = `${baseUrl}/api/internal/platform/changes?since=${since}`
    const token = this.mintIngestToken()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          // Token is NOT logged — only sent in the Authorization header
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err) {
      throw new Error(
        `Data-lane request to InmoView change-feed failed: ${(err as Error).message}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `Data-lane change-feed returned non-2xx status: ${response.status}`,
      )
    }

    return response.json() as Promise<ChangeFeedResponse>
  }

  /**
   * GET /api/internal/platform/tenants
   *
   * Fetches the full bounded batch of tenants from InmoView's internal
   * registry endpoint (A13) — used by the one-time backfill seed (A12) to
   * populate `platform_tenants` with pre-existing tenants.
   *
   * Mints a service token with the SAME claims as `fetchChanges` (reuses
   * `mintIngestToken`). Returns the parsed body on 2xx, or throws on non-2xx.
   */
  async fetchAllTenants(): Promise<TenantsBackfillResponse> {
    const baseUrl = this.trimTrailingSlash(this.inmoviewApiInternalUrl)
    const url = `${baseUrl}/api/internal/platform/tenants`
    const token = this.mintIngestToken()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          // Token is NOT logged — only sent in the Authorization header
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err) {
      throw new Error(
        `Backfill request to InmoView tenants endpoint failed: ${(err as Error).message}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `Backfill tenants endpoint returned non-2xx status: ${response.status}`,
      )
    }

    return response.json() as Promise<TenantsBackfillResponse>
  }

  /**
   * GET /api/internal/platform/tenants/:id/summary?offset=<n>&limit=<n>
   *
   * Fetches the on-demand counts + activity-feed summary for a single tenant
   * from InmoView (platform-tenant-tracking D7 — extends this client rather
   * than adding a new one). Mints a service token with the SAME claims as
   * `fetchChanges`/`fetchAllTenants` (reuses `mintIngestToken`).
   *
   * Throws `TenantSummaryFetchError` on any failure: `status` is set to the
   * upstream HTTP status for a non-2xx response, and left `undefined` when
   * InmoView is unreachable (network failure) — the caller (TenantDetailService)
   * uses this to map InmoView 404 -> 404, everything else -> 502.
   */
  async fetchTenantSummary(
    tenantId: string,
    offset: number,
    limit: number,
  ): Promise<PlatformTenantSummaryResponse> {
    const baseUrl = this.trimTrailingSlash(this.inmoviewApiInternalUrl)
    // encodeURIComponent the tenantId (consistent with the control-lane client
    // hardening) so a crafted id segment can't re-route the signed internal call.
    const url = `${baseUrl}/api/internal/platform/tenants/${encodeURIComponent(tenantId)}/summary?offset=${offset}&limit=${limit}`
    const token = this.mintIngestToken()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          // Token is NOT logged — only sent in the Authorization header
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err) {
      throw new TenantSummaryFetchError(
        `Tenant-summary request to InmoView failed: ${(err as Error).message}`,
      )
    }

    if (!response.ok) {
      throw new TenantSummaryFetchError(
        `Tenant-summary endpoint returned non-2xx status: ${response.status}`,
        response.status,
      )
    }

    return response.json() as Promise<PlatformTenantSummaryResponse>
  }

  /**
   * GET /api/internal/platform/tenants/:tenantId/document-versions/:versionId/read-url
   *
   * operator-activity-media (Slice 2a, D5/D6): mints a fresh signed read URL
   * for a document version. Mints a service token with the SAME claims as
   * `fetchChanges`/`fetchTenantSummary` (reuses `mintIngestToken`).
   * `encodeURIComponent` on both path segments (mirrors `fetchTenantSummary`
   * — hardens against a crafted id segment re-routing the signed internal
   * call). Throws on any non-2xx (404 cross-tenant/missing propagates as-is
   * to the caller, which maps it to a ViewPro 404 — no typed error class
   * needed here since the only caller distinction is "ok or not").
   */
  async fetchDocumentReadUrl(tenantId: string, versionId: string): Promise<PlatformDocumentReadUrlResponse> {
    const baseUrl = this.trimTrailingSlash(this.inmoviewApiInternalUrl)
    const url = `${baseUrl}/api/internal/platform/tenants/${encodeURIComponent(tenantId)}/document-versions/${encodeURIComponent(versionId)}/read-url`
    const token = this.mintIngestToken()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          // Token is NOT logged — only sent in the Authorization header
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err) {
      throw new DocumentReadUrlFetchError(
        `Document-read-url request to InmoView failed: ${(err as Error).message}`,
      )
    }

    if (!response.ok) {
      throw new DocumentReadUrlFetchError(
        `Document-read-url endpoint returned non-2xx status: ${response.status}`,
        response.status,
      )
    }

    return response.json() as Promise<PlatformDocumentReadUrlResponse>
  }

  private trimTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }
}

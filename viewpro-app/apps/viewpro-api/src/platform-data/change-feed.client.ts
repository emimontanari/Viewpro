import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { ChangeFeedResponse } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

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
   *  - exp: now + 120s
   */
  private mintIngestToken(): string {
    return this.jwtService.sign(
      {
        iss: 'viewpro-api',
        aud: 'inmoview-control',
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

  private trimTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }
}

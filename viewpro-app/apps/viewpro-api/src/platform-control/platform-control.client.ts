import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { PlatformTenantStatus, PlatformTenantLimits } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * Options for constructing PlatformControlClient directly (unit-testable).
 */
export interface PlatformControlClientOptions {
  inmoviewApiInternalUrl: string
  platformControlSecret: string
}

/**
 * PlatformControlClient — outbound side of the platform control lane.
 *
 * Mints a short-lived HS256 service token per request and POSTs commands
 * to InmoView's internal platform-control endpoints.
 *
 * Security invariants:
 * - Signed with PLATFORM_CONTROL_SECRET (NOT ACCESS_TOKEN_SECRET).
 * - Token is NEVER logged or persisted.
 * - A fresh token and idempotencyKey is generated per operator request.
 */
@Injectable()
export class PlatformControlClient {
  private readonly inmoviewApiInternalUrl: string
  private readonly jwtService: JwtService

  /**
   * Supports two construction modes:
   *  1. NestJS DI: pass (ConfigService) — used at runtime.
   *  2. Direct construction: pass (PlatformControlClientOptions) — used in unit tests.
   */
  constructor(configOrOptions: ConfigService | PlatformControlClientOptions) {
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
   * Mint a short-lived HS256 service token for an operator command.
   *
   * Claims:
   *  - iss: 'viewpro-api'
   *  - aud: 'inmoview-control'
   *  - sub: operatorId (=callerId in PlatformServiceIdentity)
   *  - jti: random UUID (tokenId)
   *  - exp: now + 120s
   */
  mintServiceToken(operatorId: string): string {
    const jti = crypto.randomUUID()
    return this.jwtService.sign(
      {
        iss: 'viewpro-api',
        aud: 'inmoview-control',
        jti,
      },
      {
        subject: operatorId,
        expiresIn: 120,
      },
    )
  }

  /**
   * POST /api/internal/platform/tenants/:tenantId/status
   *
   * Sends a SetTenantStatusCommand to InmoView's internal endpoint.
   * Returns the parsed response body on 2xx, or throws on non-2xx.
   */
  async postTenantStatus(
    tenantId: string,
    command: { targetStatus: PlatformTenantStatus },
    idempotencyKey: string,
    operatorId: string,
  ): Promise<unknown> {
    const url = `${this.trimTrailingSlash(this.inmoviewApiInternalUrl)}/api/internal/platform/tenants/${tenantId}/status`
    return this.post(url, { targetStatus: command.targetStatus, idempotencyKey }, operatorId)
  }

  /**
   * POST /api/internal/platform/tenants/:tenantId/limits
   *
   * Sends a SetTenantLimitsCommand to InmoView's internal endpoint.
   * Returns the parsed response body on 2xx, or throws on non-2xx.
   */
  async postTenantLimits(
    tenantId: string,
    limits: PlatformTenantLimits,
    idempotencyKey: string,
    operatorId: string,
  ): Promise<unknown> {
    const url = `${this.trimTrailingSlash(this.inmoviewApiInternalUrl)}/api/internal/platform/tenants/${tenantId}/limits`
    return this.post(url, { limits, idempotencyKey }, operatorId)
  }

  private async post(url: string, body: unknown, operatorId: string): Promise<unknown> {
    const token = this.mintServiceToken(operatorId)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Token is NOT logged — only sent in the Authorization header
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new Error(
        `Control-lane request to InmoView failed: ${(err as Error).message}`,
      )
    }

    if (!response.ok) {
      let errorBody: unknown
      try {
        errorBody = await response.json()
      } catch {
        errorBody = { statusCode: response.status, message: 'Unknown downstream error' }
      }
      // Throw a NestJS HttpException so the global exception filter preserves
      // the downstream status code (404, 400, etc.) instead of collapsing to 500.
      // The operator receives the same status InmoView returned.
      const safeBody =
        typeof errorBody === 'string' || (typeof errorBody === 'object' && errorBody !== null)
          ? (errorBody as string | Record<string, unknown>)
          : { statusCode: response.status, message: 'Unknown downstream error' }
      throw new HttpException(safeBody, response.status)
    }

    return response.json()
  }

  private trimTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }
}

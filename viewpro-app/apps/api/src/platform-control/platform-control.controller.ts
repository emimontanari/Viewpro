import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantLimitsService } from '../admin/admin-tenant-limits.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantStatusService } from '../admin/admin-tenant-status.service'
import type { JsonValue } from '@prisma/client/runtime/library'
import type { PlatformControlRequest } from './platform-control.guard'
import { PlatformControlGuard } from './platform-control.guard'
import { IDEMPOTENCY_REPOSITORY, type IIdempotencyRepository } from './idempotency.repository'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantStatusDto } from './dto/set-tenant-status.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantLimitsDto } from './dto/set-tenant-limits.dto'

/**
 * Internal platform control endpoints.
 *
 * Protected by PlatformControlGuard (HS256 service JWT, PLATFORM_CONTROL_SECRET).
 * Delegates to AdminTenantStatusService/AdminTenantLimitsService with operator actor.
 * Enforces idempotency via platform_command_log (insert-first pattern).
 *
 * Trust isolation invariant: request.user is NEVER set on this controller's paths.
 */
@Controller('internal/platform')
@UseGuards(PlatformControlGuard)
export class PlatformControlController {
  constructor(
    private readonly adminTenantStatusService: AdminTenantStatusService,
    private readonly adminTenantLimitsService: AdminTenantLimitsService,
    @Inject(IDEMPOTENCY_REPOSITORY)
    private readonly idempotencyRepository: IIdempotencyRepository,
  ) {}

  /**
   * POST /internal/platform/tenants/:tenantId/status
   * Applies a tenant status change on behalf of an operator.
   * Idempotent: duplicate idempotencyKey returns stored result with 200.
   */
  @Post('tenants/:tenantId/status')
  @HttpCode(200)
  async updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantStatusDto,
    @Req() request: PlatformControlRequest,
  ) {
    const operatorId = request.platformCaller!.callerId

    return this.applyWithIdempotency({
      idempotencyKey: body.idempotencyKey,
      tenantId,
      commandType: 'SET_STATUS',
      apply: () =>
        this.adminTenantStatusService.updateTenantStatus({
          tenantId,
          targetStatus: body.targetStatus,
          actor: { type: 'operator', operatorId },
        }),
    })
  }

  /**
   * POST /internal/platform/tenants/:tenantId/limits
   * Applies a tenant limits change on behalf of an operator.
   * Idempotent: duplicate idempotencyKey returns stored result with 200.
   */
  @Post('tenants/:tenantId/limits')
  @HttpCode(200)
  async updateTenantLimits(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantLimitsDto,
    @Req() request: PlatformControlRequest,
  ) {
    const operatorId = request.platformCaller!.callerId

    return this.applyWithIdempotency({
      idempotencyKey: body.idempotencyKey,
      tenantId,
      commandType: 'SET_LIMITS',
      apply: () =>
        this.adminTenantLimitsService.updateTenantLimits({
          tenantId,
          limits: body.limits,
          actor: { type: 'operator', operatorId },
        }),
    })
  }

  /**
   * Template method: apply a command with insert-first idempotency.
   *
   * Strategy:
   * 1. Try to INSERT the idempotency key with a sentinel value.
   *    - Success → first call; apply the mutation, then store the real result
   *      under a result-key so replays can return it.
   *    - P2002 (conflict) → duplicate call; return the stored result immediately.
   *
   * We use two keys: the primary key (reserves the slot) and a result key
   * (holds the outcome JSON for replay). The primary-key insert must succeed
   * atomically before the mutation runs, closing the concurrent-duplicate race.
   */
  private async applyWithIdempotency<T>({
    idempotencyKey,
    tenantId,
    commandType,
    apply,
  }: {
    idempotencyKey: string
    tenantId: string
    commandType: string
    apply: () => Promise<T>
  }): Promise<T | JsonValue> {
    // Step 1: reserve the slot (primary key)
    const slotCheck = await this.idempotencyRepository.insertOrFind(
      idempotencyKey,
      tenantId,
      commandType,
      { reserved: true } as JsonValue,
    )

    if (slotCheck.found) {
      // Duplicate call — fetch and return the stored result
      const resultCheck = await this.idempotencyRepository.insertOrFind(
        `${idempotencyKey}::result`,
        tenantId,
        `${commandType}_RESULT`,
        null as unknown as JsonValue,
      )
      // Return result if stored; otherwise return the sentinel (should not happen in normal flow)
      return resultCheck.found ? resultCheck.result : slotCheck.result
    }

    // Step 2: apply the mutation (slot was new)
    const result = await apply()

    // Step 3: store the result for future replays
    await this.idempotencyRepository.insertOrFind(
      `${idempotencyKey}::result`,
      tenantId,
      `${commandType}_RESULT`,
      result as unknown as JsonValue,
    )

    return result
  }
}

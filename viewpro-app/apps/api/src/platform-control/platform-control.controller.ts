import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantLimitsService } from '../admin/admin-tenant-limits.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantStatusService } from '../admin/admin-tenant-status.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaService } from '../database/prisma.service'
import type { Prisma } from '@prisma/client'
import type { JsonValue } from '@prisma/client/runtime/library'
import type { PlatformControlRequest } from './platform-control.guard'
import { PlatformControlGuard } from './platform-control.guard'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantStatusDto } from './dto/set-tenant-status.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantLimitsDto } from './dto/set-tenant-limits.dto'

/**
 * Internal platform control endpoints.
 *
 * Protected by PlatformControlGuard (HS256 service JWT, PLATFORM_CONTROL_SECRET).
 * Delegates to AdminTenantStatusService/AdminTenantLimitsService with operator actor.
 * Enforces idempotency via platform_command_log (single-transaction atomic model).
 *
 * Trust isolation invariant: request.user is NEVER set on this controller's paths.
 *
 * Idempotency model (single-row, single-transaction):
 *   1. Within a single Prisma transaction:
 *      a. INSERT the idempotency row with a temporary placeholder result.
 *         - P2002 on the UNIQUE idempotencyKey → duplicate; fetch and return stored result.
 *      b. Run the mutation (status/limits update) in the SAME transaction.
 *      c. UPDATE the idempotency row with the real result.
 *   2. On success: ONE row per command, result contains the real outcome.
 *   3. On any error (not found, bad request, unexpected): the whole transaction rolls back.
 *      The idempotency key is NOT committed → a retry re-attempts the full mutation.
 *
 * This ensures atomicity: there is no window where a row is committed but
 * the mutation has not run (or vice versa).
 */
@Controller('internal/platform')
@UseGuards(PlatformControlGuard)
export class PlatformControlController {
  constructor(
    private readonly adminTenantStatusService: AdminTenantStatusService,
    private readonly adminTenantLimitsService: AdminTenantLimitsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
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
      apply: (tx) =>
        this.adminTenantStatusService.updateTenantStatus(
          {
            tenantId,
            targetStatus: body.targetStatus,
            actor: { type: 'operator', operatorId },
          },
          tx,
        ),
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
      apply: (tx) =>
        this.adminTenantLimitsService.updateTenantLimits(
          {
            tenantId,
            limits: body.limits,
            actor: { type: 'operator', operatorId },
          },
          tx,
        ),
    })
  }

  /**
   * Apply a command with single-transaction atomic idempotency.
   *
   * All three steps — reserve slot, apply mutation, store result — run in ONE
   * Prisma transaction. If anything fails, the whole transaction rolls back:
   * the idempotency key is not committed, so a retry can re-attempt.
   *
   * The UNIQUE constraint on idempotencyKey acts as the concurrency gate:
   * only one concurrent writer can insert a given key; the second one gets
   * P2002 and returns the stored result immediately (no duplicate apply).
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
    apply: (tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>
  }): Promise<T | JsonValue> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Step 1: Atomically reserve the idempotency slot.
        // We use a placeholder result; it is overwritten in step 3.
        // If the key already exists (P2002), we fall through to the catch block.
        await tx.platformCommandLog.create({
          data: {
            idempotencyKey,
            tenantId,
            commandType,
            // Placeholder overwritten in step 3 with the real result.
            // Must be a valid JSON object (field is non-nullable in schema).
            result: { __pending: true } as Prisma.InputJsonValue,
          },
        })

        // Step 2: Run the mutation in the SAME transaction.
        // If this throws (BadRequest, NotFound, etc.) the whole transaction rolls
        // back — the idempotency row is NOT committed, so a retry can re-attempt.
        const result = await apply(tx)

        // Step 3: Replace the placeholder with the real result in the SAME row.
        await tx.platformCommandLog.update({
          where: { idempotencyKey },
          data: { result: result as unknown as Prisma.InputJsonValue },
        })

        return result
      })
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Duplicate idempotencyKey: the command was already successfully applied.
        // Return the stored result with 200 — no re-apply, no second analytics event.
        const existing = await this.prisma.platformCommandLog.findUnique({
          where: { idempotencyKey },
          select: { result: true },
        })
        // If the row is somehow gone (extremely unlikely), let the error propagate
        if (!existing) {
          throw err
        }
        return existing.result
      }
      // All other errors (NotFound, BadRequest, unexpected DB errors) propagate
      // so NestJS exception filters translate them to the correct HTTP status.
      throw err
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

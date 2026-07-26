import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard, type AuthenticatedRequest } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { StepUpGuard } from '../auth/guards/step-up.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformTenantRepository } from '../platform-data/platform-tenant.repository'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { RecordPaymentDto } from './dto/record-payment.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { ReversePaymentDto } from './dto/reverse-payment.dto'
import { createBillingPeriod } from './billing-period'
import { parseMinorUnits } from './money'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PaymentsService } from './payments.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantBillingStatusService } from './tenant-billing-status.service'
import type { RecordedPayment } from './payment-repository.port'

/**
 * PaymentsController (viewpro-api) — operator-facing money ledger.
 *
 * Guard order mirrors PlatformControlController: class-level AuthGuard (401)
 * → PlatformPermissionGuard (403 PERMISSION_DENIED) → method-level StepUpGuard
 * (403 STEP_UP_REQUIRED) on both mutations. StepUpGuard is applied WITHOUT
 * `@StepUpStatusTargets`, so it always demands a fresh step-up — money
 * mutations have no exempt case the way reactivating a tenant does.
 *
 * Money never leaves this service: no control-lane call, no InmoView write,
 * nothing added to platform-contract.
 *
 * Spec: Record a Payment, Reversal Corrects Without Erasing, Payment History
 *   Endpoint, Money Mutations Require Step-Up, Permission Separation.
 */
@Controller('operators')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly tenants: PlatformTenantRepository,
    private readonly billing: TenantBillingStatusService,
  ) {}

  @Post('tenants/:tenantId/payments')
  @HttpCode(201)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.PAYMENTS_WRITE)
  @UseGuards(StepUpGuard)
  async record(
    @Param('tenantId') tenantId: string,
    @Body() body: RecordPaymentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaymentResponse> {
    const known = await this.tenants.findByIds([tenantId])

    if (!known.has(tenantId)) {
      throw new NotFoundException(`Tenant ${tenantId} is not in the platform registry`)
    }

    const periodStart = toCalendarDate(body.periodStart)
    const periodEnd = toCalendarDate(body.periodEnd)

    // Domain rules throw domain errors (RangeError/TypeError). Left alone they
    // surface as 500, which would blame the server for what is a client
    // mistake — and hide the actual reason from whoever is filling the form.
    // Translated here, at the HTTP boundary, so the domain stays free of
    // transport concerns.
    const amountMinorUnits = asBadRequest(() => parseMinorUnits(body.amountMinorUnits))
    asBadRequest(() => createBillingPeriod(periodStart, periodEnd))

    const payment = await this.payments.record(
      {
        tenantId,
        amountMinorUnits,
        currency: body.currency ?? 'ARS',
        method: body.method,
        plan: body.plan,
        periodStart,
        periodEnd,
        receiptReference: body.receiptReference ?? null,
        note: body.note ?? null,
        recordedByOperatorId: request.user!.id,
      },
      actorOf(request),
    )

    return toResponse(payment)
  }

  @Post('payments/:paymentId/reversal')
  @HttpCode(201)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
  @UseGuards(StepUpGuard)
  async reverse(
    @Param('paymentId') paymentId: string,
    @Body() body: ReversePaymentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaymentResponse> {
    const reversal = await this.payments.reverse(
      { paymentId, reason: body.reason, recordedByOperatorId: request.user!.id },
      actorOf(request),
    )

    return toResponse(reversal)
  }

  /**
   * History and billing state in one response.
   *
   * They travel together because the console always needs both, and splitting
   * them into two requests would let the page render a paid-through date from
   * one moment beside a payment list from another.
   */
  @Get('tenants/:tenantId/payments')
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.PAYMENTS_READ)
  async listByTenant(@Param('tenantId') tenantId: string): Promise<TenantPaymentsResponse> {
    const [payments, billing] = await Promise.all([
      this.payments.listByTenant(tenantId),
      this.billing.forTenant(tenantId),
    ])

    return {
      paidThroughAt: billing.paidThroughAt,
      overdueDays: billing.overdueDays,
      payments: payments.map(toResponse),
    }
  }
}

export interface TenantPaymentsResponse {
  paidThroughAt: string | null
  /** Days since paid-through, or null when the tenant is not overdue. */
  overdueDays: number | null
  payments: PaymentResponse[]
}

export interface PaymentResponse {
  id: string
  tenantId: string
  /** String, not number — see RecordPaymentDto for why. */
  amountMinorUnits: string
  currency: string
  method: string
  plan: string
  periodStart: string
  periodEnd: string
  receiptReference: string | null
  note: string | null
  recordedByOperatorId: string
  recordedAt: string
  reversalOfPaymentId: string | null
  reversalReason: string | null
  reversedByPaymentId: string | null
  /** Convenience flag so the console never has to infer it. */
  isReversed: boolean
}

/**
 * Run a domain rule, turning its failure into a 400 with the domain's own
 * message. The domain keeps throwing plain RangeError/TypeError; only this
 * boundary knows those mean "the client sent something wrong".
 */
function asBadRequest<T>(rule: () => T): T {
  try {
    return rule()
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw new BadRequestException(error.message)
    }

    throw error
  }
}

function actorOf(request: AuthenticatedRequest) {
  return { id: request.user!.id, email: request.user!.email }
}

/**
 * The DTO accepts a full ISO-8601 value; the ledger stores calendar dates.
 * Anything carrying a time component is rejected rather than silently
 * truncated, because "2026-08-31T21:00:00-03:00" and "2026-08-31" mean the
 * same day to a person but not to whoever wrote the client.
 */
function toCalendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(
      `Period dates must be calendar dates (YYYY-MM-DD), received "${value}"`,
    )
  }

  return value
}

function toResponse(payment: RecordedPayment): PaymentResponse {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    amountMinorUnits: payment.amountMinorUnits.toString(),
    currency: payment.currency,
    method: payment.method,
    plan: payment.plan,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    receiptReference: payment.receiptReference,
    note: payment.note,
    recordedByOperatorId: payment.recordedByOperatorId,
    recordedAt: payment.recordedAt.toISOString(),
    reversalOfPaymentId: payment.reversalOfPaymentId,
    reversalReason: payment.reversalReason,
    reversedByPaymentId: payment.reversedByPaymentId,
    isReversed: payment.reversedByPaymentId !== null,
  }
}

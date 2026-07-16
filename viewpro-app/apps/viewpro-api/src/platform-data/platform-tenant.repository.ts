import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type {
  TenantRegisteredPayload,
  TenantStatusChangedPayload,
  PlatformTenantRegistryLimits,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import { PLAN_CATALOG, planMatchesLimits, type PlanCode } from '../platform-plans/plan-catalog'

/**
 * PlatformTenantRepository — persists the `platform_tenants` registry
 * projection (Phase 7 slice 2A).
 *
 * Every write is an idempotent upsert keyed on `id` (spec invariant).
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the
 * InmoView client.
 */
@Injectable()
export class PlatformTenantRepository {
  private readonly logger = new Logger(PlatformTenantRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A8: TENANT_REGISTERED → upsert full identity + limits.
   * Re-delivery of the same event is idempotent (upsert on id).
   */
  async upsertFromRegistered(payload: TenantRegisteredPayload): Promise<void> {
    const { id, name, slug, newStatus, limits, trialEndsAt } = payload

    // Defensive guard: a REGISTERED payload may arrive with `limits` missing or
    // undefined. Treat that as all-null limits instead of throwing a TypeError
    // on the destructure — an ingest throw here would poison the whole batch and
    // stall the cursor (head-of-line blocking).
    const safeLimits = limits ?? {
      maxUsers: null,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: null,
    }

    // Guarded parse: an invalid/unparseable string is treated as absent rather
    // than thrown (same non-stalling-ingest posture as the limits guard above).
    const parsedTrialEndsAt = parseTrialEndsAt(trialEndsAt)

    await this.prisma.platformTenant.upsert({
      where: { id },
      create: {
        id,
        name,
        slug,
        latestStatus: newStatus,
        maxUsers: safeLimits.maxUsers,
        maxActivePropertyEngagements: safeLimits.maxActivePropertyEngagements,
        maxDocumentsStorageMb: safeLimits.maxDocumentsStorageMb,
        trialEndsAt: parsedTrialEndsAt,
      },
      update: {
        name,
        slug,
        latestStatus: newStatus,
        maxUsers: safeLimits.maxUsers,
        maxActivePropertyEngagements: safeLimits.maxActivePropertyEngagements,
        maxDocumentsStorageMb: safeLimits.maxDocumentsStorageMb,
        // PRESENT-ONLY update — never null out an already-projected trialEndsAt
        // when the payload lacks the field (mirrors upsertFromStatusChange's
        // name/slug spread pattern below). scripts/backfill-platform-tenants.ts
        // builds payloads WITHOUT trialEndsAt; an unconditional update would
        // wipe an already-set date on every backfill re-run.
        ...(parsedTrialEndsAt !== null ? { trialEndsAt: parsedTrialEndsAt } : {}),
      },
    })

    // D5 universal choke point: the UPDATE branch above also overwrites the
    // three limit columns, so a TENANT_REGISTERED whose limits diverge from an
    // already-assigned plan must clear the stale label too — exactly as
    // applyLimitsChange does. Safe no-op on the create path: a brand-new tenant
    // has no plan, and recomputePlanDrift's `if (!storedPlan) return` guard
    // short-circuits. When the new limits still match the stored tier the pure
    // reverse-lookup keeps the label untouched.
    await this.recomputePlanDrift(id, safeLimits)
  }

  /**
   * A9: TENANT_STATUS_CHANGED → update latestStatus (+ name/slug when present).
   * Create-if-missing: a status change may arrive before the tenant's
   * TENANT_REGISTERED row exists (deploy/backfill window) — the row is
   * created with id + latestStatus so no tenant is lost.
   */
  async upsertFromStatusChange(
    tenantId: string,
    payload: TenantStatusChangedPayload,
  ): Promise<void> {
    await this.prisma.platformTenant.upsert({
      where: { id: tenantId },
      create: {
        id: tenantId,
        name: payload.name ?? '',
        slug: payload.slug ?? '',
        latestStatus: payload.newStatus,
      },
      update: {
        latestStatus: payload.newStatus,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      },
    })
  }

  /**
   * platform-manual-plans (Slice 4, Part 1) — TENANT_LIMITS_CHANGED →
   * full overwrite of the 3 limit columns (design D3).
   *
   * Full overwrite, not present-only: the event carries the full truth, and
   * `null` (unlimited) is a legitimate target value — a present-only update
   * would make it impossible to clear a limit back to unlimited.
   *
   * Update-if-exists only (no create-if-missing): a limits event can't
   * fabricate a valid `latestStatus` row — seqNo ordering guarantees
   * TENANT_REGISTERED is always ingested first for a real tenant, so a
   * missing row here means the event is stale/out-of-order and is silently
   * skipped rather than creating a partial row.
   */
  async applyLimitsChange(
    tenantId: string,
    limits: PlatformTenantRegistryLimits,
  ): Promise<void> {
    const { count } = await this.prisma.platformTenant.updateMany({
      where: { id: tenantId },
      data: {
        maxUsers: limits.maxUsers,
        maxActivePropertyEngagements: limits.maxActivePropertyEngagements,
        maxDocumentsStorageMb: limits.maxDocumentsStorageMb,
      },
    })

    // Observability for the zero-match drop: update-if-exists means a
    // TENANT_LIMITS_CHANGED for a tenant with no projection row matches ZERO
    // rows and is silently skipped (no create — a limits event carries no
    // `latestStatus`, so no valid row can be fabricated). That drop is
    // intentional and non-stalling (no throw, cursor still advances), but it
    // must not be invisible: without a trace the limits change is permanently
    // lost from the projection. Emit a warning so a pre-projection/backfill-
    // window tenant is diagnosable.
    if (count === 0) {
      this.logger.warn(
        `TENANT_LIMITS_CHANGED received for tenant ${tenantId} with no platform_tenants projection row — limits update dropped (likely a pre-projection/backfill-window tenant)`,
      )
      return
    }

    await this.recomputePlanDrift(tenantId, limits)
  }

  /**
   * platform-manual-plans (Slice 4, Part 2) — D5: single choke point for the
   * plan-vs-limits drift recompute. Every write that overwrites the limit
   * columns funnels through here — both `applyLimitsChange`
   * (TENANT_LIMITS_CHANGED, including assign-plan's OWN push) AND
   * `upsertFromRegistered`'s UPDATE branch (TENANT_REGISTERED re-delivery) — so
   * this one recompute covers:
   *  - a raw limits edit that no longer matches the stored plan → cleared
   *  - a TENANT_REGISTERED whose limits diverge from the stored plan → cleared
   *  - assign-plan's own push, which re-matches its own tier → kept, no
   *    self-clear (order-insensitive: setPlan may run before or after this)
   *
   * A stored `plan` value that is not a known `PlanCode` (legacy/corrupt
   * data) is treated as non-matching and cleared rather than throwing.
   */
  private async recomputePlanDrift(
    tenantId: string,
    limits: PlatformTenantRegistryLimits,
  ): Promise<void> {
    const row = await this.prisma.platformTenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    })

    const storedPlan = row?.plan
    if (!storedPlan) {
      return
    }

    const matches = isPlanCode(storedPlan) && planMatchesLimits(storedPlan, limits)
    if (!matches) {
      await this.prisma.platformTenant.update({
        where: { id: tenantId },
        data: { plan: null },
      })
    }
  }

  /**
   * platform-manual-plans (Slice 4, Part 2) — command-written seam (D4):
   * the ONLY write path for `plan`, called by the assign-plan endpoint AFTER
   * the limits control-lane push succeeds (design D7 ordering).
   */
  async setPlan(tenantId: string, plan: PlanCode): Promise<void> {
    // Non-throwing on a missing row (mirrors applyLimitsChange's zero-match
    // posture): the assign-plan flow pushes the tier's limits to InmoView
    // FIRST (enforced), THEN calls setPlan. For a not-yet-projected /
    // backfill-window tenant no platform_tenants row exists — a plain
    // update() would throw Prisma P2025 and 500 AFTER the successful,
    // already-enforced limits side effect (and every retry would 500 again).
    // updateMany matches zero rows instead of throwing, so the endpoint stays
    // idempotent and successful; the plan LABEL is simply not stored (the
    // limits are already enforced, and a later TENANT_REGISTERED will project
    // the row) — surfaced via a warn so it is diagnosable.
    const { count } = await this.prisma.platformTenant.updateMany({
      where: { id: tenantId },
      data: { plan },
    })

    if (count === 0) {
      this.logger.warn(
        `setPlan(${plan}) for tenant ${tenantId} matched no platform_tenants projection row — plan label not stored (likely a pre-projection/backfill-window tenant; limits were already enforced control-lane-side)`,
      )
    }
  }
}

function isPlanCode(value: string): value is PlanCode {
  return value in PLAN_CATALOG
}

/**
 * Parses `trialEndsAt` (ISO 8601 UTC string) into a `Date`, or `null` when
 * absent or unparseable. An invalid value is treated identically to an
 * absent field — never thrown (non-stalling-ingest guard, mirrors the
 * `limits` guard above).
 *
 * The wire payload is ingested via an unvalidated cast, so an explicit JSON
 * `null` (`"trialEndsAt": null`) can reach here — the param type is widened to
 * reflect that. `null` must be treated as absent, NOT fall through to
 * `new Date(null)` (epoch 1970, whose getTime() is 0, not NaN).
 */
function parseTrialEndsAt(trialEndsAt: string | null | undefined): Date | null {
  if (trialEndsAt === undefined || trialEndsAt === null) {
    return null
  }

  const parsed = new Date(trialEndsAt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

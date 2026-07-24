import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { OPERATOR_REPOSITORY, type IOperatorRepository } from '../auth/repositories/operator.repository'
import { PlatformTenantRepository } from './platform-tenant.repository'

export type AuditLogItem = {
  id: string
  action: string
  tenantId: string | null
  // audit-view (Slice 1, Phase 1), design D4 — ADDITIVE: resolved tenant
  // name alongside the raw `tenantId` above. NEVER replaces it — forensics
  // requires the raw id to stay visible even when the name lookup misses
  // (deleted/unknown tenant, Scenario: unknown tenantId).
  tenantName: string | null
  actor: unknown
  // audit-view (Slice 1, Phase 1), design D4/D8 — ADDITIVE: resolved actor
  // display email alongside the raw `actor` above. VIEWPRO_NATIVE → inline
  // passthrough; INMOVIEW_OUTBOX operator actor → batch-resolved via
  // IOperatorRepository; INMOVIEW_OUTBOX user actor → null (FE renders the
  // generic label "Usuario de la inmobiliaria" — no InmoView call, out of
  // scope for this backend slice).
  actorEmail: string | null
  target: unknown
  previousValue: unknown
  newValue: unknown
  occurredAt: string
  seqNo: number | null
  source: 'INMOVIEW_OUTBOX' | 'VIEWPRO_NATIVE'
}

export type AuditFeedList = {
  total: number
  items: AuditLogItem[]
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/** Narrow shape of the free-form `actor` Json column, just enough to branch on. */
type RawActor = {
  id?: string
  type?: string
  email?: string
}

/**
 * AuditService — paginated read of the operator global audit feed (A9/A10).
 *
 * Reads EXCLUSIVELY from `platform_audit_log` via PrismaService
 * (@prisma-platform/client) — never touches InmoView's database.
 *
 * audit-view (Slice 1, Phase 1), design D14: the feed's raw-id-only shape is
 * superseded by this change (see design D1-D8) — batch name resolution below
 * enriches every page with resolved tenant/actor display identity, additive
 * to the raw ids.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformTenantRepository: PlatformTenantRepository,
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
  ) {}

  /**
   * List audit rows sorted by occurredAt DESC (newest first), paginated by
   * offset/limit. Interleaves InmoView-outbox rows (source=INMOVIEW_OUTBOX,
   * populated seqNo/tenantId) and ViewPro-native rows
   * (source=VIEWPRO_NATIVE, seqNo/tenantId null, target populated) —
   * platform-operator-management (A4), Decision 1.
   *
   * A9: `limit` is capped at 200 regardless of the requested value.
   *
   * Ordering changed from `seqNo: 'desc'` to `occurredAt: 'desc'` because
   * native rows have no seqNo (null) — occurredAt is the only field both
   * origins always populate, so it is the sole correct interleave key.
   *
   * audit-view (Slice 1, Phase 1), design D1: after `findMany`, batch-
   * resolves tenant names and operator-actor emails in exactly TWO calls
   * total (one per lookup kind), run with `Promise.all` — never per-row
   * (no N+1). D3: operator actors are resolved via dedupe +
   * `Promise.all(IOperatorRepository.findById)` — bounded by MAX_LIMIT (200
   * deduped single-row lookups worst case), not a true N+1 over an unbounded
   * set.
   */
  async listAudit(offset = 0, limit: number = DEFAULT_LIMIT): Promise<AuditFeedList> {
    const cappedLimit = Math.min(limit, MAX_LIMIT)

    const [total, rows] = await Promise.all([
      this.prisma.platformAuditLog.count(),
      this.prisma.platformAuditLog.findMany({
        skip: offset,
        take: cappedLimit,
        orderBy: { occurredAt: 'desc' },
      }),
    ])

    const tenantIds = new Set<string>()
    const operatorActorIds = new Set<string>()

    for (const row of rows) {
      if (row.tenantId) {
        tenantIds.add(row.tenantId)
      }

      if (row.source === 'INMOVIEW_OUTBOX') {
        const actor = row.actor as RawActor | null
        if (actor?.type === 'operator' && actor.id) {
          operatorActorIds.add(actor.id)
        }
      }
    }

    const [tenantNameById, operatorEmailById] = await Promise.all([
      this.platformTenantRepository.findByIds([...tenantIds]),
      this.resolveOperatorEmails([...operatorActorIds]),
    ])

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        tenantId: row.tenantId,
        tenantName: row.tenantId ? (tenantNameById.get(row.tenantId) ?? null) : null,
        actor: row.actor,
        actorEmail: this.resolveActorEmail(row.source, row.actor as RawActor | null, operatorEmailById),
        target: row.target,
        previousValue: row.previousValue,
        newValue: row.newValue,
        occurredAt: row.occurredAt.toISOString(),
        // W1: convert BigInt (Prisma column) to number at the JSON boundary
        // (mirrors PrismaOutboxRepository.findSince / CursorRepository).
        // Native rows have seqNo: null — preserved as null, never coerced to 0.
        seqNo: row.seqNo === null ? null : Number(row.seqNo),
        source: row.source,
      })),
    }
  }

  /**
   * D3: dedupe the unique operator actor ids referenced by the page, then
   * resolve each with one `IOperatorRepository.findById` call via
   * `Promise.all` — a single batch round, not a new interface method (the
   * interface has 26 callers; widening it for one feature is disproportionate,
   * per design D3). A missing row simply has no entry in the returned Map —
   * callers degrade gracefully (Scenario: missing operator row).
   */
  private async resolveOperatorEmails(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map()
    }

    const operators = await Promise.all(ids.map((id) => this.operatorRepository.findById(id)))

    const emailById = new Map<string, string>()
    operators.forEach((operator, index) => {
      const id = ids[index]
      if (operator && id) {
        emailById.set(id, operator.email)
      }
    })

    return emailById
  }

  /**
   * D8: branch by source/actor.type.
   * - VIEWPRO_NATIVE: actor.email is already inline — passthrough, zero lookup.
   * - INMOVIEW_OUTBOX + type 'operator': resolved via the batch operator map.
   * - INMOVIEW_OUTBOX + type 'user' (or unknown/missing): null — the FE
   *   renders the generic "Usuario de la inmobiliaria" label; no InmoView call.
   */
  private resolveActorEmail(
    source: 'INMOVIEW_OUTBOX' | 'VIEWPRO_NATIVE',
    actor: RawActor | null,
    operatorEmailById: Map<string, string>,
  ): string | null {
    if (source === 'VIEWPRO_NATIVE') {
      return actor?.email ?? null
    }

    if (actor?.type === 'operator' && actor.id) {
      return operatorEmailById.get(actor.id) ?? null
    }

    return null
  }
}

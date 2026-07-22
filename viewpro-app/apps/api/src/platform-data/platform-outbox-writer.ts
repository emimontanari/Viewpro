import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type {
  TenantRegisteredPayload,
  AuditLoggedPayload,
  TenantLimitsChangedPayload,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * OutboxEventInput — discriminated union of all supported outbox event shapes (A5).
 *
 * Adding a new event type: extend the union here and in
 * packages/platform-contract/src/data/platform-outbox-event.ts.
 */
type OutboxEventInput =
  | {
      eventType: 'TENANT_STATUS_CHANGED'
      tenantId: string
      payload: {
        previousStatus: string
        newStatus: string
        name?: string
        slug?: string
      }
      occurredAt: Date
    }
  | {
      eventType: 'TENANT_REGISTERED'
      tenantId: string
      payload: TenantRegisteredPayload
      occurredAt: Date | string
    }
  | {
      eventType: 'AUDIT_LOGGED'
      tenantId: string
      payload: AuditLoggedPayload
      occurredAt: Date
    }
  | {
      eventType: 'TENANT_LIMITS_CHANGED'
      tenantId: string
      payload: TenantLimitsChangedPayload
      occurredAt: Date
    }

/**
 * OUTBOX_LOCK_KEY — fixed Postgres advisory lock key used to serialize outbox
 * seqNo assignment to COMMIT order.
 *
 * Problem: platform_outbox_events.seqNo is BIGSERIAL (allocated at INSERT under
 * READ COMMITTED). Two concurrent status-change transactions on different tenants
 * can allocate seqNo N and N+1 but commit in reverse order. The poller uses
 * `seqNo > cursor` and advances to max(batch), so it can jump the cursor past N
 * while N is still uncommitted — permanently skipping N.
 *
 * Fix: pg_advisory_xact_lock(OUTBOX_LOCK_KEY) is held until the transaction
 * commits, serializing the INSERT+COMMIT sequence across all callers. Because
 * outbox writes happen only on operator-initiated status changes (low-frequency
 * admin-control-lane operations), the contention cost is negligible.
 */
export const OUTBOX_LOCK_KEY = 8776650001n

/**
 * PlatformOutboxWriter — inserts one platform_outbox_events row using the
 * CALLER'S transaction client. The row commits iff the outer transaction commits.
 *
 * Design D3: called inside the SAME run(client) closure as the domain mutation.
 * Never opens a new connection; never swallows errors.
 *
 * C1 (seqNo-gap fix): acquires a transaction-scoped Postgres advisory lock
 * (OUTBOX_LOCK_KEY) BEFORE the insert so that seqNo allocation and COMMIT are
 * serialized. pg_advisory_xact_lock is automatically released at transaction end,
 * so no explicit unlock is needed.
 */
@Injectable()
export class PlatformOutboxWriter {
  async emit(tx: Prisma.TransactionClient, event: OutboxEventInput): Promise<void> {
    // C1: Acquire the advisory lock BEFORE the INSERT so seqNo assignment and
    // COMMIT are serialized. This prevents the poller from skipping seqNos that
    // are allocated but not yet committed. The lock is held until the outer
    // transaction commits or rolls back — no explicit release needed.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OUTBOX_LOCK_KEY})`

    // AUDIT_LOGGED's payload carries `unknown`-typed previousValue/newValue (loose
    // JSON, display-only trail — A7/A8). Prisma's generated Json input type requires
    // InputJsonValue, so a narrow cast is needed here; the insert itself is unchanged.
    await tx.platformOutboxEvent.create({
      data: event as Prisma.PlatformOutboxEventUncheckedCreateInput,
    })
  }
}

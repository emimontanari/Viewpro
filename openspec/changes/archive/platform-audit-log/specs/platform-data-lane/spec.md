# Delta for platform-data-lane

## ADDED Requirements

### Requirement: AUDIT_LOGGED Event Type

The `PlatformOutboxEvent.eventType` union in `platform-contract` MUST be
widened to include `AUDIT_LOGGED` alongside `TENANT_STATUS_CHANGED` and
`TENANT_REGISTERED`. Its payload type MUST be
`{ action: string; previousValue: unknown; newValue: unknown; actor: { type: 'operator' | 'user'; id: string; label: string } }`
— `action` is a plain forward-compatible string (e.g.
`'TENANT_STATUS_CHANGED'`, `'TENANT_LIMITS_UPDATED'`), and
`previousValue`/`newValue` are loose JSON (display-only trail, no schema
migration required for future mutation types). `tenantId` and `occurredAt`
are carried on the outbox event envelope, as with the existing event
types — they are NOT duplicated inside the payload. The
`PlatformOutboxWriter` input type MUST accept `AUDIT_LOGGED` alongside the
existing two event types so all three can be emitted from InmoView without
a separate code path.

#### Scenario: Contract accepts AUDIT_LOGGED as a valid eventType

- GIVEN the platform-contract package is updated with the widened union type
- WHEN code attempts to construct an `AUDIT_LOGGED` outbox event input with `action`, `previousValue`, `newValue`, and `actor`
- THEN the TypeScript compiler accepts the type without error

#### Scenario: Contract continues to accept the existing event types

- GIVEN the platform-contract package is updated
- WHEN code constructs a `TENANT_STATUS_CHANGED` or `TENANT_REGISTERED` outbox event input
- THEN the TypeScript compiler accepts both — backward compatibility is preserved

---

### Requirement: Ingest Routing for AUDIT_LOGGED

The viewpro-api ingest job's per-event routing MUST gain an explicit case
for `eventType = AUDIT_LOGGED` that appends/upserts the event into the
`platform_audit_log` projection ONLY, idempotent on
`sourceEventId = event.id` (the `platform_audit_log.sourceEventId` unique
constraint is the sole durability/replay-dedup mechanism for this event
type). `AUDIT_LOGGED` events MUST NOT be written to
`platform_mirror_events` — they carry no `newStatus`, and the pre-existing
W2 guard in `MirrorRepository.upsertEvent` already correctly skips them
without requiring any code change (see the dedicated requirement below).
`AUDIT_LOGGED` events MUST NOT be routed to `platform_tenants` either —
they carry no tenant identity/status/limits shape and MUST NOT mutate that
table. The cursor MUST still advance past `AUDIT_LOGGED` events after a
successful batch (non-stalling, same as any other processed event).
Routing for `TENANT_REGISTERED` and `TENANT_STATUS_CHANGED` into
`platform_tenants` (and their existing mirror append) MUST remain
unaffected by this addition, and any other still-unrecognized `eventType`
MUST continue to be skipped without error.

#### Scenario: AUDIT_LOGGED routes to platform_audit_log only

- GIVEN an `AUDIT_LOGGED` event is ingested
- WHEN the ingest job processes it
- THEN exactly one row is appended to `platform_audit_log`
- AND `platform_tenants` is not modified by this event
- AND no row is appended to `platform_mirror_events` for this event

#### Scenario: Existing routing for TENANT_REGISTERED and TENANT_STATUS_CHANGED is unaffected

- GIVEN one `TENANT_REGISTERED` event and one `TENANT_STATUS_CHANGED` event are ingested alongside an `AUDIT_LOGGED` event in the same batch
- WHEN the ingest job processes the batch
- THEN `platform_tenants` reflects the registration and status-change routing exactly as before this change
- AND `platform_mirror_events` gains exactly two rows (one per status-bearing event) — none for the `AUDIT_LOGGED` event
- AND `platform_audit_log` gains exactly one row, for the `AUDIT_LOGGED` event only

#### Scenario: Re-delivery of AUDIT_LOGGED is idempotent via platform_audit_log's own unique constraint

- GIVEN an `AUDIT_LOGGED` event with `sourceEventId = evt-1` has already been routed into `platform_audit_log`
- WHEN the same event is ingested again (re-delivery)
- THEN `platform_audit_log` still contains exactly one row for `evt-1`, deduplicated by its own `sourceEventId` unique constraint (not by the mirror, which never received this event type)
- AND no error is raised

#### Scenario: Ingest of AUDIT_LOGGED advances the cursor without a mirror row

- GIVEN a batch contains a single `AUDIT_LOGGED` event with `seqNo = N`
- WHEN `ingestBatch` processes it successfully
- THEN one row is appended to `platform_audit_log`, no row is appended to `platform_mirror_events`, and the cursor advances to `N`

---

## MODIFIED Requirements

### Requirement: Mirror Append — W2 Guard Correctly Excludes AUDIT_LOGGED (No MirrorRepository Change)

`MirrorRepository.upsertEvent`'s W2 guard skips the mirror append (and logs
a warning) for any event whose `payload.newStatus` is missing or empty.
`AUDIT_LOGGED` events legitimately carry no `newStatus` field at all — they
are not status or registration events — so the existing, unmodified W2
guard correctly and intentionally excludes `AUDIT_LOGGED` from
`platform_mirror_events`. This exclusion MUST be preserved: `MetricsService`
computes tenant status breakdowns with a latest-event-wins query
(`SELECT DISTINCT ON ("tenantId") "tenantId", "newStatus" FROM
"platform_mirror_events" ... ORDER BY seqNo DESC`). If an `AUDIT_LOGGED`
event (no status) were ever appended to the mirror, it would become the
"latest" row for its tenant and corrupt that tenant's status breakdown with
a blank/undefined status. No change to `MirrorRepository` is required or
permitted to accommodate `AUDIT_LOGGED` — the guard's existing behavior for
`TENANT_STATUS_CHANGED` and `TENANT_REGISTERED` (and, as a side effect, for
`AUDIT_LOGGED`) MUST remain exactly as it is today.

(Previously: this exclusion was an incidental side effect of the W2 guard,
undocumented for any event type other than `TENANT_STATUS_CHANGED` /
`TENANT_REGISTERED`. It is now an explicit, load-bearing requirement for
`AUDIT_LOGGED` as well — with no code change.)

#### Scenario: AUDIT_LOGGED is skipped from the mirror by the existing W2 guard

- GIVEN an `AUDIT_LOGGED` event whose payload has no `newStatus` field
- WHEN `MirrorRepository.upsertEvent` processes it
- THEN no `platform_mirror_events` row is created for the event
- AND this occurs via the guard's existing, unmodified logic — no new `MirrorRepository` code path is introduced for `AUDIT_LOGGED`

#### Scenario: TENANT_STATUS_CHANGED with missing newStatus is still skipped (regression)

- GIVEN a `TENANT_STATUS_CHANGED` event whose payload is missing `newStatus`
- WHEN `MirrorRepository.upsertEvent` processes it
- THEN no `platform_mirror_events` row is created for the event
- AND a `[W2]` skip warning is logged, exactly as before this change

#### Scenario: Tenant status metrics are not corrupted by AUDIT_LOGGED events

- GIVEN a tenant's most recent status-bearing event in `platform_mirror_events` is `TENANT_STATUS_CHANGED` with `newStatus = ACTIVE`
- AND an `AUDIT_LOGGED` event for that tenant (e.g. a subsequent limits change) is ingested afterward
- WHEN `MetricsService`'s latest-event-wins `byStatus` query runs (`DISTINCT ON (tenantId) ... ORDER BY seqNo DESC` over `platform_mirror_events`)
- THEN the tenant is still counted under `ACTIVE` — the `AUDIT_LOGGED` event never entered `platform_mirror_events`, so it cannot become the "latest" row and cannot blank out the tenant's status bucket

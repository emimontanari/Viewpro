// resolution-mode="require" tells tsc to resolve @viewpro/platform-contract via the
// CJS "require" path even though the package declares "type":"module". Since the package
// entry point is a .ts source file (not a compiled .js), tsc can still read its types.
// This is a pure compile-time file; no runtime import is emitted.
import type {
  PlatformTenantStatus,
  PlatformOutboxEvent,
  PlatformTenantRegistryLimits,
  AuditActor,
  AuditLoggedPayload,
  TenantRegisteredPayload,
  TenantLimitsChangedPayload,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { TenantStatus, Tenant } from '@prisma/client'

/**
 * Compile-time assertion that PlatformTenantStatus (from @viewpro/platform-contract)
 * is bidirectionally equal to TenantStatus (from @prisma/client).
 *
 * If this file compiles, the two types are identical and in sync.
 * If they drift, tsc will report a type error here before any code ships.
 * Mirrors the pattern established in platform-control/type-assertions.ts.
 */
type _AssertPlatformTenantStatusEqualsTenantStatus =
  [PlatformTenantStatus] extends [TenantStatus]
    ? [TenantStatus] extends [PlatformTenantStatus]
      ? true
      : never
    : never

const _typeCheck: _AssertPlatformTenantStatusEqualsTenantStatus = true
void _typeCheck

// ---------------------------------------------------------------------------
// T-02/T-03 — TENANT_REGISTERED union coverage + limits field mirror (A2)
// ---------------------------------------------------------------------------

/**
 * Positive: TENANT_REGISTERED is a valid eventType in the widened union (A1/A2).
 * Compile error here → the contract union was not widened.
 */
type _AssertTenantRegisteredInUnion =
  ['TENANT_REGISTERED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertRegistered: _AssertTenantRegisteredInUnion = true
void _assertRegistered

/**
 * Positive: TENANT_STATUS_CHANGED remains valid — backward compatibility (A3).
 */
type _AssertTenantStatusChangedInUnion =
  ['TENANT_STATUS_CHANGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertStatusChanged: _AssertTenantStatusChangedInUnion = true
void _assertStatusChanged

/**
 * Negative: an unknown literal is NOT assignable to the eventType union.
 * The @ts-expect-error suppresses the type error; if the type were widened to
 * `string`, tsc would warn that the expect-error is unnecessary.
 */
// @ts-expect-error — 'UNKNOWN_TYPE' is not assignable to the eventType union
const _assertUnknownRejected: PlatformOutboxEvent['eventType'] = 'UNKNOWN_TYPE'
void _assertUnknownRejected

/**
 * Mirror check: PlatformTenantRegistryLimits fields must match Tenant's nullable
 * Int? columns exactly (number | null). Compile error → fields have drifted (A2).
 */
type _AssertLimitsFieldsMatchTenant = {
  maxUsers: [PlatformTenantRegistryLimits['maxUsers']] extends [Tenant['maxUsers']]
    ? [Tenant['maxUsers']] extends [PlatformTenantRegistryLimits['maxUsers']]
      ? true
      : never
    : never
  maxActivePropertyEngagements: [PlatformTenantRegistryLimits['maxActivePropertyEngagements']] extends [Tenant['maxActivePropertyEngagements']]
    ? [Tenant['maxActivePropertyEngagements']] extends [PlatformTenantRegistryLimits['maxActivePropertyEngagements']]
      ? true
      : never
    : never
  maxDocumentsStorageMb: [PlatformTenantRegistryLimits['maxDocumentsStorageMb']] extends [Tenant['maxDocumentsStorageMb']]
    ? [Tenant['maxDocumentsStorageMb']] extends [PlatformTenantRegistryLimits['maxDocumentsStorageMb']]
      ? true
      : never
    : never
}

const _assertLimits: _AssertLimitsFieldsMatchTenant = {
  maxUsers: true,
  maxActivePropertyEngagements: true,
  maxDocumentsStorageMb: true,
}
void _assertLimits

// ---------------------------------------------------------------------------
// T-02/T-03 (platform-audit-log) — AUDIT_LOGGED union coverage + payload shape
// ---------------------------------------------------------------------------

/**
 * Positive: AUDIT_LOGGED is a valid eventType in the widened union (A1/A2).
 * Compile error here → the contract union was not widened.
 */
type _AssertAuditLoggedInUnion =
  ['AUDIT_LOGGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertAuditLogged: _AssertAuditLoggedInUnion = true
void _assertAuditLogged

/**
 * Regression: TENANT_STATUS_CHANGED and TENANT_REGISTERED remain assignable
 * after widening the union with AUDIT_LOGGED.
 */
type _AssertTenantStatusChangedStillInUnion =
  ['TENANT_STATUS_CHANGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertTenantStatusChangedStill: _AssertTenantStatusChangedStillInUnion = true
void _assertTenantStatusChangedStill

type _AssertTenantRegisteredStillInUnion =
  ['TENANT_REGISTERED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertTenantRegisteredStill: _AssertTenantRegisteredStillInUnion = true
void _assertTenantRegisteredStill

/**
 * Positive: AuditLoggedPayload is assignable to PlatformOutboxEvent['payload'].
 */
type _AssertAuditLoggedPayloadInUnion =
  [AuditLoggedPayload] extends [PlatformOutboxEvent['payload']] ? true : never

const _assertAuditLoggedPayload: _AssertAuditLoggedPayloadInUnion = true
void _assertAuditLoggedPayload

const _assertAuditPayloadShape: AuditLoggedPayload = {
  action: 'TENANT_STATUS_CHANGED',
  previousValue: { status: 'TRIAL' },
  newValue: { status: 'ACTIVE' },
  actor: { id: 'op-1', type: 'operator', label: 'op-1' },
}
void _assertAuditPayloadShape

/**
 * Negative: AuditActor['type'] is 'operator' | 'user' — a literal 'admin' is NOT
 * assignable. The @ts-expect-error suppresses the type error; if the type were
 * widened to `string`, tsc would warn that the expect-error is unnecessary.
 */
// @ts-expect-error — 'admin' is not assignable to AuditActor['type']
const _assertBadActorType: AuditActor['type'] = 'admin'
void _assertBadActorType

// ---------------------------------------------------------------------------
// platform-self-service-onboarding — TenantRegisteredPayload['trialEndsAt']
// additive-optional field (A3-style enrichment)
// ---------------------------------------------------------------------------

/**
 * Positive: TenantRegisteredPayload['trialEndsAt'] is `string | undefined`
 * (ISO 8601 UTC, additive-optional — matches `occurredAt: string` convention).
 * Compile error here → the contract field was not added, or its type drifted.
 */
type _AssertTrialEndsAtIsOptionalString =
  [TenantRegisteredPayload['trialEndsAt']] extends [string | undefined]
    ? [string | undefined] extends [TenantRegisteredPayload['trialEndsAt']]
      ? true
      : never
    : never

const _assertTrialEndsAtType: _AssertTrialEndsAtIsOptionalString = true
void _assertTrialEndsAtType

/**
 * Positive: a legacy TENANT_REGISTERED payload literal without `trialEndsAt`
 * remains assignable — the field is additive-optional, not required (A3
 * backward-compatibility guarantee).
 */
const _assertLegacyPayloadStillAssignable: TenantRegisteredPayload = {
  id: 'tenant-legacy',
  name: 'Legacy Co',
  slug: 'legacy-co',
  newStatus: 'TRIAL',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
}
void _assertLegacyPayloadStillAssignable

// ---------------------------------------------------------------------------
// platform-manual-plans (Slice 4, Part 1) — TENANT_LIMITS_CHANGED outbox
// event: eventType union member + TenantLimitsChangedPayload shape.
// ---------------------------------------------------------------------------

/**
 * Positive: TENANT_LIMITS_CHANGED is a valid eventType in the widened union.
 * Compile error here → the contract union was not widened.
 */
type _AssertTenantLimitsChangedInUnion =
  ['TENANT_LIMITS_CHANGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertLimitsChanged: _AssertTenantLimitsChangedInUnion = true
void _assertLimitsChanged

/**
 * Regression: TENANT_STATUS_CHANGED, TENANT_REGISTERED, and AUDIT_LOGGED
 * remain assignable after widening the union with TENANT_LIMITS_CHANGED.
 */
type _AssertTenantStatusChangedStillInUnionAfterLimits =
  ['TENANT_STATUS_CHANGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertTenantStatusChangedStillAfterLimits: _AssertTenantStatusChangedStillInUnionAfterLimits = true
void _assertTenantStatusChangedStillAfterLimits

type _AssertTenantRegisteredStillInUnionAfterLimits =
  ['TENANT_REGISTERED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertTenantRegisteredStillAfterLimits: _AssertTenantRegisteredStillInUnionAfterLimits = true
void _assertTenantRegisteredStillAfterLimits

type _AssertAuditLoggedStillInUnionAfterLimits =
  ['AUDIT_LOGGED'] extends [PlatformOutboxEvent['eventType']] ? true : never

const _assertAuditLoggedStillAfterLimits: _AssertAuditLoggedStillInUnionAfterLimits = true
void _assertAuditLoggedStillAfterLimits

/**
 * Positive: TenantLimitsChangedPayload is assignable to PlatformOutboxEvent['payload'].
 */
type _AssertTenantLimitsChangedPayloadInUnion =
  [TenantLimitsChangedPayload] extends [PlatformOutboxEvent['payload']] ? true : never

const _assertLimitsChangedPayload: _AssertTenantLimitsChangedPayloadInUnion = true
void _assertLimitsChangedPayload

/**
 * Literal-shape assertion: TenantLimitsChangedPayload carries the three
 * nullable limit fields (mirrors PlatformTenantRegistryLimits exactly).
 */
const _assertLimitsChangedPayloadShape: TenantLimitsChangedPayload = {
  limits: { maxUsers: 10, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
}
void _assertLimitsChangedPayloadShape

/**
 * Literal-shape assertion: null (unlimited) is valid for every limit field.
 */
const _assertLimitsChangedPayloadNullShape: TenantLimitsChangedPayload = {
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
}
void _assertLimitsChangedPayloadNullShape

/**
 * Negative: an unrelated literal eventType is still NOT assignable after the
 * union was widened with TENANT_LIMITS_CHANGED.
 */
// @ts-expect-error — 'UNKNOWN_TYPE' is not assignable to the eventType union
const _assertUnknownStillRejectedAfterLimits: PlatformOutboxEvent['eventType'] = 'UNKNOWN_TYPE'
void _assertUnknownStillRejectedAfterLimits

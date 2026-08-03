/**
 * FE-owned types for the operator global audit feed.
 *
 * Source: GET /operators/audit → apps/viewpro-api/src/platform-data/audit.service.ts
 * `previousValue`/`newValue` are loose JSON (display-only trail) — kept as
 * `unknown` here, never narrowed to a typed shape (see api/schemas.ts).
 *
 * audit-view (Slice 1, Phase 1): backend now ALWAYS resolves `tenantName`/
 * `actorEmail` additively alongside the raw `tenantId`/`actor` (design D4).
 * Typed optional here (not required) to match the existing `source?: string`
 * convention in this file and stay backward-compatible with call sites/tests
 * that predate this slice — consumption (table/drill-down rendering) is
 * Slice 3/4 scope, not this slice.
 */

// A4 — heterogeneous feed. Outbox entries carry {id,type,label}; VIEWPRO_NATIVE
// operator-management entries carry {id,email}. type/label/email are optional.
export type AuditActor = {
  id: string;
  type?: string;
  label?: string;
  email?: string;
};

// Present only on VIEWPRO_NATIVE operator actions (null/absent for outbox).
//
// audit-view (Slice 3, Phase 3) — widened to a loose union: operator-
// management actions carry {id,email} (an affected operator), while
// TENANT_DOCUMENT_VIEWED carries {documentVersionId,filename} instead
// (apps/viewpro-api/src/platform-data/audit-log.repository.ts
// appendNative()'s `target` param — both shapes are stored as-is in the
// same free-form Json column). All fields optional so either shape parses.
export type AuditTarget = {
  id?: string;
  email?: string;
  documentVersionId?: string;
  filename?: string;
  // platform-payment-ledger: PAYMENT_RECORDED names the payment row;
  // PAYMENT_REVERSED additionally names the reversal it created
  // (apps/viewpro-api/src/payments/payments.service.ts).
  paymentId?: string;
  reversalId?: string;
};

// GET /operators/audit?offset&limit → AuditFeedResponse
export type AuditLogItem = {
  id: string;
  action: string;
  tenantId: string | null; // null for native operator actions (no tenant)
  tenantName?: string | null; // resolved tenant name (D4) — additive, raw tenantId untouched
  actor: AuditActor;
  actorEmail?: string | null; // resolved actor display email (D4/D8) — additive, raw actor untouched
  target?: AuditTarget | null;
  previousValue: unknown;
  newValue: unknown;
  occurredAt: string; // ISO string
  seqNo: number | null; // null for native entries (no outbox sequence)
  source?: string; // 'INMOVIEW_OUTBOX' | 'VIEWPRO_NATIVE'
};

export type AuditFeedResponse = {
  total: number;
  items: AuditLogItem[];
};

/**
 * audit-view (Slice 3, Phase 3), design D5/D6/D9/D10 mirror — server-side
 * filters accepted by GET /operators/audit. All fields optional and
 * AND-combined server-side (viewpro-api). This slice only threads them
 * through the FE query layer (api/service.ts, api/queries.ts); the filter
 * bar UI that populates these values is Slice 4 scope.
 */
export type AuditFilters = {
  action?: string;
  source?: 'INMOVIEW_OUTBOX' | 'VIEWPRO_NATIVE';
  tenantId?: string;
  actorId?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
};

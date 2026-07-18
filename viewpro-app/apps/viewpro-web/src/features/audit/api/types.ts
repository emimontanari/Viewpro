/**
 * FE-owned types for the operator global audit feed.
 *
 * Source: GET /operators/audit → apps/viewpro-api/src/platform-data/audit.service.ts
 * Global feed only — no per-tenant filter (Q3, locked). `previousValue`/
 * `newValue` are loose JSON (display-only trail) — kept as `unknown` here,
 * never narrowed to a typed shape (see api/schemas.ts).
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
export type AuditTarget = {
  id: string;
  email?: string;
};

// GET /operators/audit?offset&limit → AuditFeedResponse
export type AuditLogItem = {
  id: string;
  action: string;
  tenantId: string | null; // null for native operator actions (no tenant)
  actor: AuditActor;
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

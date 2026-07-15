/**
 * FE-owned types for the operator global audit feed.
 *
 * Source: GET /operators/audit → apps/viewpro-api/src/platform-data/audit.service.ts
 * Global feed only — no per-tenant filter (Q3, locked). `previousValue`/
 * `newValue` are loose JSON (display-only trail) — kept as `unknown` here,
 * never narrowed to a typed shape (see api/schemas.ts).
 */

export type AuditActor = {
  id: string;
  type: string;
  label: string;
};

// GET /operators/audit?offset&limit → AuditFeedResponse
export type AuditLogItem = {
  id: string;
  action: string;
  tenantId: string;
  actor: AuditActor;
  previousValue: unknown;
  newValue: unknown;
  occurredAt: string; // ISO string
  seqNo: number;
};

export type AuditFeedResponse = {
  total: number;
  items: AuditLogItem[];
};

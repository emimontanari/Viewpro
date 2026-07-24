/**
 * audit-view (Slice 3, Phase 3) — actor/source display helpers shared by
 * AuditTable (design D11) and AuditRowDetail (design D12). Extracted to a
 * small sibling module (rather than exported from audit-table.tsx) so
 * audit-row-detail.tsx can reuse the exact same actor-resolution logic
 * without a circular import between the two components.
 */
import type { AuditLogItem } from '@/features/audit/api/types';

// verify-slice1's D11 conformance finding: an INMOVIEW_OUTBOX actor of
// type:'user' has NO resolvable email (design D8 — no InmoView call is
// made), and its `label`/`id` are BOTH the raw actor UUID
// (apps/api/src/admin/audit-actor.ts: `{ id: actor.userId, type: 'user',
// label: actor.userId }`). Falling through to actor.label/actor.id would
// leak that raw UUID as PRIMARY content, failing the spec's "a raw UUID
// MUST NOT appear as primary content" requirement. This generic label is
// shown instead, before that fallback is ever reached.
export const GENERIC_USER_ACTOR_LABEL = 'Usuario de la inmobiliaria';

/**
 * A4/D11 — heterogeneous actor priority: the resolved `actorEmail` (design
 * D4/D8) is the best available identity; then a VIEWPRO_NATIVE actor's
 * inline `email`; then the type:'user' generic label above (D11 gap fix);
 * only then the outbox operator's `label`/`id` (both already raw ids by
 * design for the operator case too, but there is nothing better to show).
 */
export function actorPrimary(item: AuditLogItem): string {
  if (item.actorEmail) {
    return item.actorEmail;
  }
  if (item.actor.email) {
    return item.actor.email;
  }
  if (item.actor.type === 'user') {
    return GENERIC_USER_ACTOR_LABEL;
  }
  return item.actor.label ?? item.actor.id;
}

// Secondary line: outbox actor `type`, or a sensible role for native entries.
export function actorSecondary(item: AuditLogItem): string {
  return item.actor.type ?? (item.source === 'VIEWPRO_NATIVE' ? 'operador' : '');
}

const SOURCE_LABELS: Record<string, string> = {
  INMOVIEW_OUTBOX: 'InmoView',
  VIEWPRO_NATIVE: 'ViewPro'
};

// Free-string `source`; known values map to a short badge label, an
// unmapped/absent value degrades to an em-dash rather than throwing.
export function sourceLabel(source?: string): string {
  return source ? (SOURCE_LABELS[source] ?? source) : '—';
}

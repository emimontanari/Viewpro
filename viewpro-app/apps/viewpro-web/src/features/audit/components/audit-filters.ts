/**
 * audit-view (Slice 4, Phase 4), design D9/D10 — pure helpers translating the
 * filter bar's raw (string-only, nuqs-friendly) UI values into the server
 * `AuditFilters` shape (api/types.ts) consumed by `auditFeedOptions`.
 *
 * Kept framework-free (no React) so it's trivially unit-testable and can be
 * shared between AuditFeedPage (owns the nuqs state, design D9) and
 * AuditFilterBar (purely presentational/controlled, design D10) without
 * either needing to know about the other's internals.
 */
import type { AuditFilters } from '@/features/audit/api/types';

// All-string shape — mirrors AuditFilters but every field is always present
// (never optional) so it round-trips cleanly through nuqs' useQueryStates,
// which needs a stable default value per key. '' means "not set".
export type AuditFilterValues = {
  action: string;
  source: string;
  tenantId: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTER_VALUES: AuditFilterValues = {
  action: '',
  source: '',
  tenantId: '',
  actorId: '',
  dateFrom: '',
  dateTo: ''
};

const VALID_SOURCES: ReadonlySet<string> = new Set(['INMOVIEW_OUTBOX', 'VIEWPRO_NATIVE']);

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date-range boundary decision (carried over from Slice 2's apply report,
 * Learned #2): the backend's `dateTo` filter is EXCLUSIVE
 * (`occurredAt: { lt: new Date(dateTo) }`, raw parsed Date, NO
 * business-timezone day-boundary math — apps/viewpro-api
 * audit.controller.ts's `sanitizeDate`/audit.service.ts's `buildWhere`).
 *
 * The filter bar's date input emits a date-ONLY string (`YYYY-MM-DD`, from
 * `<input type="date">`), which `new Date(x)` parses as that day's UTC
 * midnight. Sending that raw value straight through would make `dateTo`
 * EXCLUDE the entire day the operator picked — "hasta 15 jul" would show
 * nothing from the 15th, surprising an operator who expects that day
 * included.
 *
 * Fix: shift a date-only `dateTo` to the START of the NEXT UTC calendar day
 * before it's sent, so `occurredAt < <next day 00:00 UTC>` covers every
 * instant of the picked day. `dateFrom` needs no such shift — the backend's
 * `gte` is already inclusive of the picked day's start.
 */
export function toExclusiveDateTo(dateOnly: string): string {
  const match = ISO_DATE_ONLY.exec(dateOnly);
  if (!match) {
    // Malformed date-only string (shouldn't happen from a native date
    // input, but degrade rather than throw — the backend's own sanitizer
    // silently drops anything `new Date()` can't parse anyway).
    return dateOnly;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds the server-side `AuditFilters` object from the filter bar's raw
 * values. Empty/blank fields are omitted entirely (never sent as empty
 * strings) — an all-empty `values` produces `{}`, the exact same request
 * shape as before this slice (Slice 3's backward-compat guarantee, D9).
 */
export function toAuditFilters(values: AuditFilterValues): AuditFilters {
  const filters: AuditFilters = {};

  const action = values.action.trim();
  if (action) {
    filters.action = action;
  }

  if (VALID_SOURCES.has(values.source)) {
    filters.source = values.source as AuditFilters['source'];
  }

  const tenantId = values.tenantId.trim();
  if (tenantId) {
    filters.tenantId = tenantId;
  }

  const actorId = values.actorId.trim();
  if (actorId) {
    filters.actorId = actorId;
  }

  const dateFrom = values.dateFrom.trim();
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }

  const dateTo = values.dateTo.trim();
  if (dateTo) {
    filters.dateTo = toExclusiveDateTo(dateTo);
  }

  return filters;
}

export function hasActiveAuditFilters(values: AuditFilterValues): boolean {
  return Object.keys(toAuditFilters(values)).length > 0;
}

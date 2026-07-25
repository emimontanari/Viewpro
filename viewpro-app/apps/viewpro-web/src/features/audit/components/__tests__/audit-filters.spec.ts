/**
 * Slice 4 (Phase 4), task 4.1-region — RED: pure filter-value helpers.
 * Spec: platform-audit-feed — "Server-driven filter bar" requirement.
 *
 * Covers:
 *   - all-empty values → {} (backward-compat with Slice 3's default request)
 *   - trimming + omission of blank fields
 *   - source allowlist (invalid values ignored, mirrors backend D6)
 *   - the dateTo exclusive-end boundary decision (this slice's own D-note)
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTER_VALUES,
  hasActiveAuditFilters,
  toAuditFilters,
  toExclusiveDateTo
} from '../audit-filters';

describe('toAuditFilters()', () => {
  it('returns {} when all values are empty (Slice 3 backward-compat request shape)', () => {
    expect(toAuditFilters(EMPTY_FILTER_VALUES)).toEqual({});
  });

  it('includes trimmed action/tenantId/actorId only when non-empty', () => {
    expect(
      toAuditFilters({
        ...EMPTY_FILTER_VALUES,
        action: '  OPERATOR_SUSPENDED  ',
        tenantId: '  tenant-1  ',
        actorId: '  actor-1  '
      })
    ).toEqual({ action: 'OPERATOR_SUSPENDED', tenantId: 'tenant-1', actorId: 'actor-1' });
  });

  it('ignores an invalid/unknown source value (mirrors backend D6 allowlist)', () => {
    expect(toAuditFilters({ ...EMPTY_FILTER_VALUES, source: 'NOT_A_REAL_SOURCE' })).toEqual({});
  });

  it('includes a valid source value', () => {
    expect(toAuditFilters({ ...EMPTY_FILTER_VALUES, source: 'VIEWPRO_NATIVE' })).toEqual({
      source: 'VIEWPRO_NATIVE'
    });
  });

  it('passes dateFrom through unchanged (backend gte is already inclusive of the picked day)', () => {
    expect(toAuditFilters({ ...EMPTY_FILTER_VALUES, dateFrom: '2026-07-01' })).toEqual({
      dateFrom: '2026-07-01'
    });
  });

  it('shifts dateTo to the start of the NEXT day so the whole picked day is included (date-range boundary decision)', () => {
    // Operator picks "hasta 15 jul" expecting every event that occurred
    // during the 15th to be included. The backend applies an EXCLUSIVE
    // `occurredAt: { lt: new Date(dateTo) }` with no day-boundary math
    // (apply-slice2 Learned #2) — so the FE must send the START of the 16th.
    expect(toAuditFilters({ ...EMPTY_FILTER_VALUES, dateTo: '2026-07-15' })).toEqual({
      dateTo: '2026-07-16'
    });
  });

  it('never throws on a malformed dateTo (degrades, passes the raw value through)', () => {
    expect(() => toAuditFilters({ ...EMPTY_FILTER_VALUES, dateTo: 'not-a-date' })).not.toThrow();
  });

  it('AND-combines multiple simultaneous filters into one object', () => {
    expect(
      toAuditFilters({
        action: 'TENANT_LIMITS_UPDATED',
        source: 'INMOVIEW_OUTBOX',
        tenantId: 'tenant-9',
        actorId: '',
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30'
      })
    ).toEqual({
      action: 'TENANT_LIMITS_UPDATED',
      source: 'INMOVIEW_OUTBOX',
      tenantId: 'tenant-9',
      dateFrom: '2026-01-01',
      dateTo: '2026-07-01'
    });
  });
});

describe('hasActiveAuditFilters()', () => {
  it('is false for all-empty values', () => {
    expect(hasActiveAuditFilters(EMPTY_FILTER_VALUES)).toBe(false);
  });

  it('is true when any single filter is set', () => {
    expect(hasActiveAuditFilters({ ...EMPTY_FILTER_VALUES, actorId: 'actor-1' })).toBe(true);
  });
});

describe('toExclusiveDateTo() — date-range boundary decision', () => {
  it('rolls over a month boundary', () => {
    expect(toExclusiveDateTo('2026-01-31')).toBe('2026-02-01');
  });

  it('rolls over a year boundary', () => {
    expect(toExclusiveDateTo('2025-12-31')).toBe('2026-01-01');
  });

  it('degrades a malformed date-only string by returning it unchanged (never throws)', () => {
    expect(toExclusiveDateTo('not-a-date')).toBe('not-a-date');
  });
});

/**
 * RED — categorization + date-grouping pure helpers for the tenant-detail
 * activity feed redesign (feat/web-tenant-detail-redesign).
 *
 * These helpers are PRESENTATION-ONLY: they never change the title/subtitle/
 * timestamp OUTPUT of the existing describeTenantActivityItem/
 * formatActivityTimestamp helpers — they only classify an item into one of the
 * four filter buckets and derive a stable day key / separator label / full
 * timestamp for the redesigned feed. All are read defensively (never throw).
 *
 * Category mapping (mirrors the item's STRUCTURED discriminants):
 *   kind === 'membership'                       -> 'user'    (Usuarios)
 *   kind === 'document_request'                 -> 'deed'    (Escrituras)
 *   kind === 'movement' && type === 'INQUIRY'   -> 'inquiry' (Consultas)
 *   kind === 'movement' (any other type)        -> 'update'  (Actualizaciones)
 */

import { describe, it, expect } from 'vitest';
import type { TenantActivityItem } from '../../api/types';
import {
  categorizeActivityItem,
  activityDayKey,
  formatActivityDateSeparator,
  formatActivityFullTimestamp
} from '../activity-feed-formatting';

const base = (over: Partial<TenantActivityItem> & Pick<TenantActivityItem, 'kind' | 'id'>) =>
  ({ createdAt: '2026-07-15T10:00:00.000Z', ...over }) as TenantActivityItem;

describe('categorizeActivityItem', () => {
  it('classifies any membership event as "user"', () => {
    for (const membershipEvent of ['INVITED', 'JOINED', 'DEACTIVATED', 'ROLE_CHANGED'] as const) {
      expect(categorizeActivityItem(base({ kind: 'membership', id: 'm', membershipEvent }))).toBe(
        'user'
      );
    }
  });

  it('classifies a document_request as "deed"', () => {
    expect(categorizeActivityItem(base({ kind: 'document_request', id: 'd' }))).toBe('deed');
  });

  it('classifies a movement of type INQUIRY as "inquiry"', () => {
    expect(categorizeActivityItem(base({ kind: 'movement', id: 'i', type: 'INQUIRY' }))).toBe(
      'inquiry'
    );
  });

  it('classifies every other movement type as "update"', () => {
    for (const type of ['GENERAL_UPDATE', 'VISIT_SCHEDULED', 'STATUS_CHANGE', undefined]) {
      expect(categorizeActivityItem(base({ kind: 'movement', id: 'u', type }))).toBe('update');
    }
  });

  it('never throws on a malformed/unknown item', () => {
    expect(() => categorizeActivityItem({ id: 'x' } as unknown as TenantActivityItem)).not.toThrow();
  });
});

describe('activityDayKey', () => {
  it('returns a stable per-day key for a valid ISO timestamp', () => {
    const a = activityDayKey('2026-07-15T10:00:00.000Z');
    const b = activityDayKey('2026-07-15T23:30:00.000Z');
    const c = activityDayKey('2026-07-14T10:00:00.000Z');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('degrades to a stable neutral key for a malformed timestamp (never throws)', () => {
    expect(() => activityDayKey('not-a-date')).not.toThrow();
    expect(activityDayKey('not-a-date')).toBe(activityDayKey('also-bad'));
  });
});

describe('formatActivityDateSeparator', () => {
  it('returns a non-empty human label for a valid timestamp', () => {
    expect(formatActivityDateSeparator('2026-07-15T10:00:00.000Z').length).toBeGreaterThan(0);
  });

  it('returns a neutral label for a malformed timestamp (never throws)', () => {
    expect(() => formatActivityDateSeparator('nope')).not.toThrow();
    expect(formatActivityDateSeparator('nope').length).toBeGreaterThan(0);
  });
});

describe('formatActivityFullTimestamp', () => {
  it('returns a fuller string than the short timestamp for a valid ISO', () => {
    expect(formatActivityFullTimestamp('2026-07-15T10:00:00.000Z').length).toBeGreaterThan(0);
  });

  it('fails safe to a dash for a malformed timestamp', () => {
    expect(formatActivityFullTimestamp('nope')).toBe('—');
  });
});

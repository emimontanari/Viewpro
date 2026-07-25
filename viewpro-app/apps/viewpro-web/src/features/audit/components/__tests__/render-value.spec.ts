/**
 * T-22 — RED: renderValue() defensive rendering tests
 * Spec: design Testing Strategy — renderValue renders old→new without
 *   throwing on unexpected/malformed shapes (R4)
 *
 * Tests cover:
 *   - null/undefined → '—'
 *   - plain object → key:value lines (per-field, e.g. limits deltas)
 *   - primitives (string/number/boolean) → String(v)
 *   - never throws regardless of input shape
 *   - action label map (Q4): known actions map to es-AR labels, unmapped
 *     values render raw
 */

import { describe, it, expect } from 'vitest';
import { renderValue, actionLabel, formatFullTimestamp } from '../render-value';

describe('renderValue()', () => {
  it('renders null as em-dash', () => {
    expect(renderValue(null)).toBe('—');
  });

  it('renders undefined as em-dash', () => {
    expect(renderValue(undefined)).toBe('—');
  });

  it('renders a plain object as key:value lines', () => {
    const result = renderValue({ status: 'ACTIVE' });

    expect(result).toContain('status');
    expect(result).toContain('ACTIVE');
  });

  it('renders a multi-field object with one line per field (limits delta)', () => {
    const result = renderValue({
      maxUsers: 10,
      maxActivePropertyEngagements: 50,
      maxDocumentsStorageMb: 1024
    });

    expect(result).toContain('maxUsers');
    expect(result).toContain('10');
    expect(result).toContain('maxActivePropertyEngagements');
    expect(result).toContain('50');
    expect(result).toContain('maxDocumentsStorageMb');
    expect(result).toContain('1024');
  });

  it('renders a string primitive via String(v)', () => {
    expect(renderValue('ACTIVE')).toBe('ACTIVE');
  });

  it('renders a number primitive via String(v)', () => {
    expect(renderValue(42)).toBe('42');
  });

  it('renders a boolean primitive via String(v)', () => {
    expect(renderValue(true)).toBe('true');
  });

  it('never throws on an empty object', () => {
    expect(() => renderValue({})).not.toThrow();
  });

  it('never throws on an array', () => {
    expect(() => renderValue([1, 2, 3])).not.toThrow();
  });
});

describe('actionLabel()', () => {
  it('maps TENANT_STATUS_CHANGED to "Estado"', () => {
    expect(actionLabel('TENANT_STATUS_CHANGED')).toBe('Estado');
  });

  it('maps TENANT_LIMITS_UPDATED to "Límites"', () => {
    expect(actionLabel('TENANT_LIMITS_UPDATED')).toBe('Límites');
  });

  it('renders an unmapped action raw (no throw)', () => {
    expect(actionLabel('SOME_FUTURE_ACTION')).toBe('SOME_FUTURE_ACTION');
  });

  // audit-view (Slice 3, Phase 3) — TENANT_DOCUMENT_VIEWED was missing from
  // the 7-action catalog (design "Open Questions").
  it('maps TENANT_DOCUMENT_VIEWED to "Documento visto"', () => {
    expect(actionLabel('TENANT_DOCUMENT_VIEWED')).toBe('Documento visto');
  });
});

describe('formatFullTimestamp()', () => {
  it('renders a full es-AR date/time string for a valid ISO timestamp', () => {
    const result = formatFullTimestamp('2026-07-15T10:00:00.000Z');

    expect(result).toContain('2026');
    expect(result).not.toBe('—');
  });

  it('degrades a malformed timestamp to "—" without throwing', () => {
    expect(() => formatFullTimestamp('not-a-date')).not.toThrow();
    expect(formatFullTimestamp('not-a-date')).toBe('—');
  });
});

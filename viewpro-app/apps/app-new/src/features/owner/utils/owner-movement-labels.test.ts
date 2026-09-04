import { describe, expect, it } from 'vitest';
import {
  formatOwnerHomeMovementDateTime,
  getOwnerHomeMovementVisualKind,
  getOwnerMovementTypeLabel
} from './owner-movement-labels';

describe('owner home movement presentation', () => {
  it('formats absolute Buenos Aires timestamps with fixed date and time separators', () => {
    expect(formatOwnerHomeMovementDateTime('2026-08-20T01:30:00.000Z')).toBe('19/08/2026 · 22:30');
    expect(formatOwnerHomeMovementDateTime('2026-08-20T15:04:00.000Z')).toBe('20/08/2026 · 12:04');
  });

  it('classifies only supported structured types and retains raw unknown labels', () => {
    expect(
      [
        ['INQUIRY', 'inquiry'],
        ['VISIT_SCHEDULED', 'visit'],
        ['VISIT_COMPLETED', 'visit'],
        ['DOCUMENTATION_UPDATE', 'documentation'],
        ['OFFER_RECEIVED', 'offer'],
        ['STATUS_CHANGE', 'status'],
        ['GENERAL_UPDATE', 'general'],
        ['ARCHIVED', 'neutral'],
        ['RESTORED', 'neutral'],
        ['PROMOTION_FROM_OBSERVATION', 'neutral']
      ].map(([type]) => getOwnerHomeMovementVisualKind(type))
    ).toEqual([
      'inquiry',
      'visit',
      'visit',
      'documentation',
      'offer',
      'status',
      'general',
      'neutral',
      'neutral',
      'neutral'
    ]);
    expect(getOwnerMovementTypeLabel('PROMOTION_FROM_OBSERVATION')).toBe(
      'PROMOTION_FROM_OBSERVATION'
    );
  });
});

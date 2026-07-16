/**
 * platform-operator-management (A4, PR2) — structural regression net for the
 * "Operadores" nav entry (T2.1.5). Purely declarative data (Design Decision
 * 6) — no branching logic, so a single assertion set is sufficient
 * (triangulation skipped: config constant, one possible shape).
 */

import { describe, it, expect } from 'vitest';
import { navGroups } from '../nav-config';

describe('nav-config — Operadores entry (Design Decision 6)', () => {
  it('includes an "Operadores" item pointing at /dashboard/operators, gated to OWNER', () => {
    const allItems = navGroups.flatMap((group) => group.items);
    const operatorsItem = allItems.find((item) => item.title === 'Operadores');

    expect(operatorsItem).toBeTruthy();
    expect(operatorsItem?.url).toBe('/dashboard/operators');
    expect(operatorsItem?.access).toEqual({ role: 'OWNER' });
  });
});

/**
 * T-24 — RED: AuditEmptyState component test
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (empty state scenario)
 *
 * Mirrors features/tenants/components/tenants-empty-state.tsx (es-AR copy).
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuditEmptyState } from '../audit-empty-state';

describe('AuditEmptyState', () => {
  it('renders the "Todavía no hay eventos de auditoría" message when filtered is omitted', () => {
    render(<AuditEmptyState />);

    expect(screen.getByText('Todavía no hay eventos de auditoría')).toBeTruthy();
  });

  it('renders the "Todavía no hay eventos de auditoría" message when filtered is explicitly false', () => {
    render(<AuditEmptyState filtered={false} />);

    expect(screen.getByText('Todavía no hay eventos de auditoría')).toBeTruthy();
  });

  // audit-view (Slice 4, Phase 4), spec Scenario "No rows match filters": a
  // distinct message from the unfiltered one above.
  it('renders a distinct "no matching events" message when filtered is true', () => {
    render(<AuditEmptyState filtered />);

    expect(screen.getByText('No se encontraron eventos con estos filtros')).toBeTruthy();
    expect(screen.queryByText('Todavía no hay eventos de auditoría')).toBeNull();
  });
});

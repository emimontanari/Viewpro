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
  it('renders the "Todavía no hay eventos de auditoría" message', () => {
    render(<AuditEmptyState />);

    expect(screen.getByText('Todavía no hay eventos de auditoría')).toBeTruthy();
  });
});

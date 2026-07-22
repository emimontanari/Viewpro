/**
 * platform-operator-management (A4, PR2) — RED: /dashboard/operators route
 * test. Mirrors /dashboard/tenants' page.spec.tsx (D16-equivalent). Reachable
 * only for OWNER sessions per the sidebar nav-gate — the server-side 403 is
 * the real enforcement.
 */

import * as React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/operators/components/operators-management-page', () => ({
  OperatorsManagementPage: () => (
    <div data-testid='operators-management-page'>operators management page</div>
  )
}));

import OperatorsPage from '../page';

describe('/dashboard/operators route', () => {
  it('renders OperatorsManagementPage inside PageContainer with pageTitle="Operadores"', () => {
    render(<OperatorsPage />);

    expect(screen.getByRole('heading', { name: 'Operadores' })).toBeTruthy();
    expect(screen.getByTestId('operators-management-page')).toBeTruthy();
  });
});

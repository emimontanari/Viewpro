/**
 * T-09 — RED: /dashboard/tenants route test
 * Spec: Paginated Tenant List (page reachability, scenario 1)
 *
 * Asserts the route renders <TenantsManagementPage/> inside
 * <PageContainer pageTitle="Inmobiliarias" .../> (D16). Not yet linked from
 * nav-config.ts (T-18, WU-2) — reachable only by direct URL in PR1.
 */

import * as React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/tenants/components/tenants-management-page', () => ({
  TenantsManagementPage: () => (
    <div data-testid='tenants-management-page'>tenants management page</div>
  )
}));

import TenantsPage from '../page';

describe('/dashboard/tenants route', () => {
  it('renders TenantsManagementPage inside PageContainer with pageTitle="Inmobiliarias"', () => {
    render(<TenantsPage />);

    expect(screen.getByRole('heading', { name: 'Inmobiliarias' })).toBeTruthy();
    expect(screen.getByTestId('tenants-management-page')).toBeTruthy();
  });
});

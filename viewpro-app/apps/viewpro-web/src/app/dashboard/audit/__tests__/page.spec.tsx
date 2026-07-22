/**
 * T-26 — /dashboard/audit route test
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (route gated
 *   behind authentication)
 *
 * Asserts the route renders <AuditFeedPage/> inside
 * <PageContainer pageTitle="Auditoría" .../> (mirrors app/dashboard/tenants).
 */

import * as React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/audit/components/audit-feed-page', () => ({
  AuditFeedPage: () => <div data-testid='audit-feed-page'>audit feed page</div>
}));

import AuditPage from '../page';

describe('/dashboard/audit route', () => {
  it('renders AuditFeedPage inside PageContainer with pageTitle="Auditoría"', () => {
    render(<AuditPage />);

    expect(screen.getByRole('heading', { name: 'Auditoría' })).toBeTruthy();
    expect(screen.getByTestId('audit-feed-page')).toBeTruthy();
  });
});

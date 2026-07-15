/**
 * T-05 — RED: TenantsTable component tests (read-only rendering, PR1 scope)
 * Spec: Paginated Tenant List (scenario 1: renders name/slug/status/limits, name ASC)
 *
 * Tests cover:
 *   - Renders one row per item with name, slug, status badge, limits summary
 *   - "Sin límite" shown for null limit values
 *   - Rows render in the order received (no client re-sort)
 *   - No actions column / no buttons rendered yet (PR1 read-only scope)
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { TenantListItem } from '@/features/tenants/api/types';
import { TenantsTable } from '../tenants-table';

const ITEMS: TenantListItem[] = [
  {
    id: 'tenant-1',
    name: 'Acme Realty',
    slug: 'acme-realty',
    status: 'ACTIVE',
    limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 }
  },
  {
    id: 'tenant-2',
    name: 'Beta Homes',
    slug: 'beta-homes',
    status: 'SUSPENDED',
    limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
  }
];

describe('TenantsTable — read-only rendering', () => {
  it('renders one row per item', () => {
    render(<TenantsTable items={ITEMS} />);

    expect(screen.getByTestId('tenant-row-tenant-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-row-tenant-2')).toBeTruthy();
  });

  it('renders name and slug per row', () => {
    render(<TenantsTable items={ITEMS} />);

    expect(screen.getByText('Acme Realty')).toBeTruthy();
    expect(screen.getByText('acme-realty')).toBeTruthy();
    expect(screen.getByText('Beta Homes')).toBeTruthy();
    expect(screen.getByText('beta-homes')).toBeTruthy();
  });

  it('renders a status badge per row', () => {
    render(<TenantsTable items={ITEMS} />);

    expect(screen.getByTestId('tenant-status-tenant-1').textContent).toMatch(/activo/i);
    expect(screen.getByTestId('tenant-status-tenant-2').textContent).toMatch(/suspendido/i);
  });

  it('renders the limits summary with 3 values', () => {
    render(<TenantsTable items={ITEMS} />);

    const limits = screen.getByTestId('tenant-limits-tenant-1').textContent ?? '';
    expect(limits).toContain('10');
    expect(limits).toContain('50');
    expect(limits).toContain('1.024');
  });

  it('shows "Sin límite" for null limit values', () => {
    render(<TenantsTable items={ITEMS} />);

    const limits = screen.getByTestId('tenant-limits-tenant-2').textContent ?? '';
    expect(limits.match(/sin límite/gi)?.length).toBe(3);
  });

  it('renders rows in the order received (server already sorts name ASC)', () => {
    render(<TenantsTable items={ITEMS} />);

    const rows = screen.getAllByTestId(/tenant-row-/);
    expect(rows[0].getAttribute('data-testid')).toBe('tenant-row-tenant-1');
    expect(rows[1].getAttribute('data-testid')).toBe('tenant-row-tenant-2');
  });

  it('renders no action buttons (PR1 read-only scope)', () => {
    render(<TenantsTable items={ITEMS} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

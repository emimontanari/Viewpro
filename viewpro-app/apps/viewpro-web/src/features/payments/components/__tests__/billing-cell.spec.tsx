/**
 * platform-payment-ledger (PR 3 wiring) — RED: the billing cell in the tenant
 * list.
 *
 * This cell is the only place an operator finds out that someone stopped
 * paying, because the decision was "warn, don't cut" — nothing else in the
 * product will ever tell them. If it renders nothing for an overdue tenant,
 * the compensating control for that decision does not exist.
 *
 * Spec: Overdue Is Derived and Never Restricts Access.
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BillingCell } from '../billing-cell';

describe('BillingCell', () => {
  it('shows the paid-through date for a tenant in good standing', () => {
    render(<BillingCell billing={{ paidThroughAt: '2026-09-30', overdueDays: null }} />);

    expect(screen.getByText('30/09/2026')).toBeTruthy();
  });

  it('shows the overdue badge with days elapsed', () => {
    render(<BillingCell billing={{ paidThroughAt: '2026-08-31', overdueDays: 3 }} />);

    expect(screen.getByText(/vencido hace 3 días/i)).toBeTruthy();
  });

  it('uses singular for a single day', () => {
    render(<BillingCell billing={{ paidThroughAt: '2026-08-31', overdueDays: 1 }} />);

    expect(screen.getByText(/vencido hace 1 día/i)).toBeTruthy();
  });

  it('says a tenant has no payments rather than showing an empty cell', () => {
    render(<BillingCell billing={{ paidThroughAt: null, overdueDays: null }} />);

    // An empty cell reads as "loading" or "unknown"; this state is neither.
    expect(screen.getByText(/sin pagos/i)).toBeTruthy();
  });

  it('does not show an overdue badge for a tenant that was never charged', () => {
    render(<BillingCell billing={{ paidThroughAt: null, overdueDays: null }} />);

    expect(screen.queryByText(/vencido/i)).toBeNull();
  });

  it('tolerates a missing billing field from an older API response', () => {
    // Defensive: the console may briefly run against an API deployed before
    // this slice. A crash in the tenant list would be far worse than a blank
    // billing column.
    render(<BillingCell billing={undefined} />);

    expect(screen.getByText(/sin pagos/i)).toBeTruthy();
  });
});

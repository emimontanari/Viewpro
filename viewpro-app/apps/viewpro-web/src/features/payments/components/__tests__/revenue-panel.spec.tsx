/**
 * platform-payment-ledger (PR 4) — RED: the revenue panel.
 *
 * Two things this panel must not do: report a figure without saying what it
 * measures, and stay silent about overdue tenants. The attribution note is not
 * decoration — under manual billing an annual prepayment or a transfer entered
 * late makes "collected this month" and "revenue for this month" different
 * numbers, and a figure whose basis is unstated becomes a business decision.
 *
 * Spec: Revenue Summary, Overdue Is Derived and Never Restricts Access.
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { RevenueSummary } from '@/features/payments/api/types';
import { RevenuePanel } from '../revenue-panel';

function summary(overrides: Partial<RevenueSummary> = {}): RevenueSummary {
  return {
    attribution: 'RECORDED_AT',
    overdueTenants: 0,
    months: [
      {
        month: '2026-08',
        currency: 'ARS',
        totalMinorUnits: '18000000',
        rows: [
          { plan: 'PROFESIONAL', currency: 'ARS', collectedMinorUnits: '13500000' },
          { plan: 'BASICO', currency: 'ARS', collectedMinorUnits: '4500000' }
        ]
      }
    ],
    ...overrides
  };
}

describe('RevenuePanel', () => {
  it('renders the month total without losing precision', () => {
    render(<RevenuePanel summary={summary()} />);

    expect(screen.getByText('$ 180.000,00')).toBeTruthy();
  });

  it('names the month in a readable form', () => {
    render(<RevenuePanel summary={summary()} />);

    expect(screen.getByText(/agosto 2026/i)).toBeTruthy();
  });

  it('breaks the total down by plan', () => {
    render(<RevenuePanel summary={summary()} />);

    expect(screen.getByText('$ 135.000,00')).toBeTruthy();
    expect(screen.getByText('$ 45.000,00')).toBeTruthy();
  });

  it('states what the figure measures', () => {
    render(<RevenuePanel summary={summary()} />);

    // "Collected", attributed to the month it was recorded — not accrual.
    expect(screen.getByText(/cobrado.*mes en que se registr/i)).toBeTruthy();
  });

  it('shows the overdue tenant count when there are any', () => {
    render(<RevenuePanel summary={summary({ overdueTenants: 3 })} />);

    expect(screen.getByText(/3 inmobiliarias vencidas/i)).toBeTruthy();
  });

  it('uses the singular for a single overdue tenant', () => {
    render(<RevenuePanel summary={summary({ overdueTenants: 1 })} />);

    expect(screen.getByText(/1 inmobiliaria vencida/i)).toBeTruthy();
  });

  it('says explicitly that nobody is overdue rather than hiding the row', () => {
    render(<RevenuePanel summary={summary({ overdueTenants: 0 })} />);

    // Hiding it would make "no alert" and "the panel forgot to render" look
    // identical, which is exactly the failure mode this count guards against.
    expect(screen.getByText(/sin inmobiliarias vencidas/i)).toBeTruthy();
  });

  it('handles having no payments at all', () => {
    render(<RevenuePanel summary={summary({ months: [] })} />);

    expect(screen.getByText(/todavía no hay pagos/i)).toBeTruthy();
  });
});

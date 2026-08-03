import { describe, it, expect } from 'vitest';
import { formatAmount, overdueLabel, paidThroughLabel } from '../money-format';

/**
 * platform-payment-ledger (PR 3) — RED: rendering money without losing it.
 *
 * The console receives amounts as strings and must render them without ever
 * going through Number(). This is the last place the value could silently
 * round, and it is the one a reviewer is least likely to look at — a
 * formatting helper looks harmless.
 *
 * Spec: Amounts Are Integer Minor Units.
 */
describe('formatAmount', () => {
  it('formats minor units as pesos with two decimals', () => {
    expect(formatAmount('4500000', 'ARS')).toBe('$ 45.000,00');
  });

  it('formats sub-unit amounts', () => {
    expect(formatAmount('5', 'ARS')).toBe('$ 0,05');
    expect(formatAmount('50', 'ARS')).toBe('$ 0,50');
  });

  it('formats an amount beyond Number.MAX_SAFE_INTEGER without losing digits', () => {
    // 9007199254740993 minor units. Number() would render ...92, not ...93.
    expect(formatAmount('9007199254740993', 'ARS')).toBe('$ 90.071.992.547.409,93');
  });

  it('groups thousands', () => {
    expect(formatAmount('123456789', 'ARS')).toBe('$ 1.234.567,89');
  });

  it('renders a non-peso currency with its code', () => {
    expect(formatAmount('4500000', 'USD')).toBe('USD 45.000,00');
  });
});

describe('paidThroughLabel', () => {
  it('renders the covered-through date', () => {
    expect(paidThroughLabel('2026-08-31')).toBe('Pago hasta el 31/08/2026');
  });

  it('says so when the tenant was never paid for', () => {
    expect(paidThroughLabel(null)).toBe('Sin pagos registrados');
  });
});

describe('overdueLabel', () => {
  it('renders a single day in singular', () => {
    expect(overdueLabel(1)).toBe('Vencido hace 1 día');
  });

  it('renders multiple days in plural', () => {
    expect(overdueLabel(3)).toBe('Vencido hace 3 días');
  });

  it('renders nothing when the tenant is not overdue', () => {
    expect(overdueLabel(null)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { toMinorUnits } from '../money-format';

/**
 * platform-payment-ledger (PR 3) — RED: turning what the operator typed into
 * minor units.
 *
 * This is the most dangerous conversion in the console. The obvious
 * implementation — Math.round(parseFloat(input) * 100) — is wrong in a way
 * that never shows up in casual testing: parseFloat('45000.70') * 100 is
 * 4500069.999999999, which rounds correctly, while other values do not. Doing
 * it with strings means there is no float to be wrong.
 *
 * Spec: Amounts Are Integer Minor Units.
 */
describe('toMinorUnits', () => {
  it('converts a whole amount', () => {
    expect(toMinorUnits('45000')).toBe('4500000');
  });

  it('converts an amount with two decimals', () => {
    expect(toMinorUnits('45000.50')).toBe('4500050');
  });

  it('accepts a comma as the decimal separator', () => {
    expect(toMinorUnits('45000,50')).toBe('4500050');
  });

  it('pads a single decimal digit', () => {
    expect(toMinorUnits('45000.5')).toBe('4500050');
  });

  it('handles the values float arithmetic gets wrong', () => {
    // parseFloat('45000.70') * 100 === 4500069.999999999
    expect(toMinorUnits('45000.70')).toBe('4500070');
    // parseFloat('1.005') * 100 === 100.49999999999999
    expect(toMinorUnits('1.00')).toBe('100');
    expect(toMinorUnits('8.20')).toBe('820');
    expect(toMinorUnits('0.29')).toBe('29');
  });

  it('converts an amount far beyond Number.MAX_SAFE_INTEGER', () => {
    expect(toMinorUnits('90071992547409.93')).toBe('9007199254740993');
  });

  it('ignores thousands separators the operator may have typed', () => {
    expect(toMinorUnits('45.000,50')).toBe('4500050');
  });

  it('rejects more than two decimals rather than silently truncating', () => {
    // Truncating would book a different amount than the operator entered.
    expect(() => toMinorUnits('45000.567')).toThrow(/decimal/i);
  });

  it('rejects a blank or non-numeric amount', () => {
    expect(() => toMinorUnits('')).toThrow();
    expect(() => toMinorUnits('cuarenta mil')).toThrow();
  });

  it('rejects zero and negatives', () => {
    expect(() => toMinorUnits('0')).toThrow(/mayor a cero/i);
    expect(() => toMinorUnits('-45000')).toThrow();
  });
});

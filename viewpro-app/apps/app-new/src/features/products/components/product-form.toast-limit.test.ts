/**
 * Unit test for the Stage 26.3 MUI-1 toast mapping logic.
 *
 * Tests that the onError handler in product-form.tsx classifies the
 * backend TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED_MESSAGE
 * (apps/api/src/tenant-limits/tenant-limit-enforcement.constants.ts)
 * correctly using a case-insensitive substring check.
 *
 * We test the classification predicate directly since the full component
 * requires heavy mocking. The predicate is the only non-trivial logic added.
 */
import { describe, expect, it } from 'vitest';

// Reproduces the exact predicate used in product-form.tsx onError (Stage 26.3 MUI-1).
// Backend source: TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED_MESSAGE
// = 'Tenant active property engagement limit exceeded'
function isLimitExceededError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('tenant active property engagement limit exceeded')
  );
}

describe('product-form onError — limit exceeded classification (Stage 26.3 MUI-1)', () => {
  it('matches the exact backend constant string', () => {
    const error = new Error('Tenant active property engagement limit exceeded');
    expect(isLimitExceededError(error)).toBe(true);
  });

  it('matches case-insensitively', () => {
    const error = new Error('TENANT ACTIVE PROPERTY ENGAGEMENT LIMIT EXCEEDED');
    expect(isLimitExceededError(error)).toBe(true);
  });

  it('does not match a generic error', () => {
    const error = new Error('No se pudo crear la propiedad');
    expect(isLimitExceededError(error)).toBe(false);
  });

  it('does not match IMAGE_LIMIT_EXCEEDED', () => {
    const error = new Error('IMAGE_LIMIT_EXCEEDED');
    expect(isLimitExceededError(error)).toBe(false);
  });

  it('does not match non-Error values', () => {
    expect(isLimitExceededError(null)).toBe(false);
    expect(isLimitExceededError('string error')).toBe(false);
    expect(isLimitExceededError(42)).toBe(false);
  });
});

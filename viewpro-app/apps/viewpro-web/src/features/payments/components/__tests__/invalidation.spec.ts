import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * platform-payment-ledger — RED: recording or reversing a payment must
 * invalidate every view that shows derived money state, not just the one the
 * dialog is looking at.
 *
 * Found by Judgment Day (both judges). The panel invalidated only
 * `paymentKeys.byTenant`, while the tenant LIST behind the open dialog renders
 * the paid-through / overdue BillingCell from the tenants query, and the
 * dashboard renders revenue from a third key. With the app's global
 * `staleTime: 60s`, the overdue badge kept claiming "Vencido hace N días" for
 * up to a minute after the payment that cleared it — and that badge is, by
 * design, the only signal a tenant ever stopped paying.
 *
 * Asserted against the source rather than a render because the defect is a
 * missing call, and a component test that does not mount the tenant list would
 * happily pass while the bug is still there.
 *
 * Spec: Overdue Is Derived and Never Restricts Access, Revenue Summary.
 */
describe('payment mutation invalidation', () => {
  const source = readFileSync(join(__dirname, '..', 'tenant-payments-panel.tsx'), 'utf8');

  it('invalidates the tenant list so the overdue badge cannot go stale', () => {
    expect(source).toMatch(/tenantsKeys\.all/);
  });

  it('invalidates the revenue summary so the dashboard total cannot go stale', () => {
    expect(source).toMatch(/paymentKeys\.revenue\(\)/);
  });

  it('still invalidates the tenant payment history', () => {
    expect(source).toMatch(/paymentKeys\.byTenant/);
  });

  it('applies the same invalidation to both mutations', () => {
    // Both onSuccess handlers must go through the shared helper — a fix that
    // only covers `record` would leave reversal showing a cleared badge.
    const invalidateCalls = source.match(/await invalidate\(\)/g) ?? [];

    expect(invalidateCalls.length).toBeGreaterThanOrEqual(2);
  });
});

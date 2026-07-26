import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPaymentRepository } from '../prisma-payment.repository'

/**
 * platform-payment-ledger (PR 1) — RED: the ledger is append-only.
 *
 * This is the test that protects the whole point of the table. If a future
 * change adds an `updatePayment` or lets a caller reach `prisma.tenantPayment.update`,
 * the ledger silently stops being evidence — every row becomes "whatever it
 * says now", and reconciling an activation against a bank statement proves
 * nothing. Correction must stay reversal-only.
 *
 * Spec: The Ledger Is Append-Only — "No update or delete path exists on the
 *   repository".
 */
describe('payment ledger append-only surface', () => {
  const methodNames = Object.getOwnPropertyNames(PrismaPaymentRepository.prototype).filter(
    (name) => name !== 'constructor',
  )

  it('exposes no method whose name implies mutation or removal of a recorded payment', () => {
    const mutating = methodNames.filter((name) => /update|delete|remove|edit|patch|purge/i.test(name))

    expect(mutating).toEqual([])
  })

  it('exposes exactly the ledger operations the port declares', () => {
    // Kept as an exact list rather than a "contains" check: the point is that
    // adding an operation to the ledger has to be a deliberate edit here, seen
    // by whoever reviews it. PR 3 added paidThroughByTenants (batched read) —
    // the list grows only alongside a reviewed change.
    expect(methodNames.sort()).toEqual(
      [
        'listByTenant',
        'paidThroughByTenant',
        'paidThroughByTenants',
        'record',
        'revenueByMonth',
        'reverse',
      ].sort(),
    )
  })

  it('never calls prisma update or delete on tenantPayment in its implementation', () => {
    // Reading the source is deliberate: a method could be named innocently and
    // still call `update` internally, which the name checks above would miss.
    const source = readFileSync(
      join(__dirname, '..', 'prisma-payment.repository.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/tenantPayment\s*\.\s*update/)
    expect(source).not.toMatch(/tenantPayment\s*\.\s*updateMany/)
    expect(source).not.toMatch(/tenantPayment\s*\.\s*delete/)
    expect(source).not.toMatch(/tenantPayment\s*\.\s*deleteMany/)
    expect(source).not.toMatch(/tenantPayment\s*\.\s*upsert/)
  })
})

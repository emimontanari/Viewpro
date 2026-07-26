# Apply Progress — Platform Payment Ledger

## PR 1 — Domain and ledger foundation (no routes) — **complete**

Branch: `feat/payment-ledger` (stacked on `chore/docs-sdd-consolidation`, PR #269).

### RED/GREEN evidence

| Task | RED | GREEN |
|---|---|---|
| `money.ts` — minor units, parse, sum, format | `Cannot find module './money'`, 16 tests unrunnable | 16/16 passing |
| `billing-period.ts` — period validation, paid-through, overdue, timezone | `Cannot find module './billing-period'`, 18 tests unrunnable | 18/18 passing |
| Append-only surface assertion | `Cannot find module '../prisma-payment.repository'`, 3 tests unrunnable | 3/3 passing |
| Repository integration | **See honesty note below** | 12/12 passing |

Suite after PR 1: **49 passing** in `src/payments/`; **502 passing** across the
whole `viewpro-api` suite (53 files); `typecheck` clean; `prisma validate` clean.

### Honesty note — the repository spec was not RED-first

`prisma-payment.repository.spec.ts` was written *after* the adapter, so it
passed on first run and never failed for the right reason. That is a genuine
deviation from strict TDD and is recorded rather than glossed over.

To establish the suite actually has detection power, the non-reversed filter
was deliberately mutated (`reversedBy: { is: null }` removed from `NOT_REVERSED`)
and the suite re-run:

- `stops counting a reversed payment toward paid-through` → **FAIL**
- `excludes reversed payments from revenue and sums the rest exactly` → **FAIL**

The mutation was reverted and the suite returned to 49/49. The tests bite; they
were simply written in the wrong order. The domain specs (`money`,
`billing-period`, append-only surface) *were* RED-first.

### Decisions confirmed during implementation

- **Amount survives the database round trip beyond `MAX_SAFE_INTEGER`.**
  Asserted with `9007199254740993n` written and read back through the `bigint`
  column. A `number` column would have silently corrupted it.
- **`NOT_REVERSED` means two things** — the row is not itself a reversal, and
  no reversal points at it. Both are expressed once, in the repository, so no
  caller can implement half the rule.
- **Double reversal is refused by the unique constraint**, surfaced as a 409.
  A separate test covers refusing to reverse a reversal.
- **Original rows are asserted byte-identical after reversal**, field by field
  including `recordedAt` — the property that makes the ledger evidence.

### Migration

`20260726193000_add_tenant_payments` generated **offline** via `prisma migrate diff`
against a throwaway shadow database (created and dropped in the same step);
no development database was touched to author it.

Applied to `viewpro_platform_test` only. **Production has not been migrated** —
that is Paso 4 of the go-live runbook against `DIRECT_URL`, and it belongs to
the deploy of this feature, not to this commit.

### Not done in PR 1 — by design

No HTTP route exists yet. The ledger is unreachable from outside the process
until PR 2 adds the endpoints, permissions, and step-up gating. This is
deliberate: the money primitives are locked by tests before any surface can
reach them.

---

## PR 2 — Endpoints, permissions, step-up, audit — **complete**

### RED/GREEN evidence

| Task | RED | GREEN |
|---|---|---|
| Payment permissions matrix | 4 failing — `to include undefined` (constants absent) | 6/6 passing |
| Transactional audit (`payments.service`) | `Cannot find module '../payments.service'` | 5/5 passing |
| Controller guards + validation | 1 failing — inverted period returned **500**, not 400 | 14/14 passing |

Suite after PR 2: **57 files, 538 tests passing**; typecheck clean.

### A real bug the tests caught

The controller spec failed on `rejects an inverted period with 400`: the domain
threw `RangeError`, Nest had no mapping for it, and the API answered **500**.
That blames the server for a client mistake and hides the reason from whoever is
filling the form. Fixed by translating domain errors at the HTTP boundary
(`asBadRequest`), leaving the domain free of transport concerns. Had the test
only asserted "does not write a row", the wrong status code would have shipped.

### Existing matrix locks were updated, not bypassed

Adding the three permissions broke three assertions in `role-permissions.spec.ts`
that pin each role's exact permission list. Those failures were correct — the
matrix genuinely changed — so the locks were updated to the new expected lists
and extended with explicit `not.toContain` assertions for the new boundaries
(ANALYST has no write, OPERATIONS has no reversal). The locks were never
loosened to "contains" checks.

### Notes

- `StepUpGuard` is applied **without** `@StepUpStatusTargets`, so it always
  demands a fresh step-up. Verified in the guard source: the early-return only
  fires when status targets are present.
- Every rejection test asserts a row count of zero as well as the status code.
  A 403 that still writes is worse than no guard, because the ledger would then
  hold entries nobody was authorised to make.
- `AuditLogRepository.appendNative`'s action and target unions were widened for
  `PAYMENT_RECORDED` / `PAYMENT_REVERSED`; its existing tx-threading is reused
  unchanged.

## PR 3 — Console surfaces — **complete**

### RED/GREEN evidence

| Task | RED | GREEN |
|---|---|---|
| `TenantBillingStatusService` (derived paid-through/overdue) | `Cannot find module '../tenant-billing-status.service'` | 7/7 passing |
| Tenant list billing enrichment | 3 failing — `billing` absent from rows | 3/3 passing |
| Money formatting (console) | `Failed to resolve import '../money-format'` | 10/10 passing |
| `toMinorUnits` conversion | 4 failing — function absent | 10/10 passing |
| `PaymentHistory` component | import failure | 9/9 passing |
| `RecordPaymentDialog` component | import failure | 8/8 passing |

Backend: **59 files, 548 tests passing**, typecheck clean.
Console: **37 tests passing** in `features/payments`.

### An ambiguity the tests forced into the open

`toMinorUnits` first treated any 3-digit group after a separator as thousands,
which made `45.000` (forty-five thousand) and `45000.567` (three decimals)
indistinguishable — the latter would have become **45000567**, a hundred times
the intended amount. Fixed by only accepting thousands notation when the whole
string matches `^\d{1,3}([.,]\d{3})+$`; anything else treats the last separator
as decimal and rejects more than two decimal places rather than truncating.
Truncating would book a different amount than the operator entered.

The conversion is string-based throughout. `Math.round(parseFloat(x) * 100)` —
the obvious implementation — is wrong for values like `45000.70`
(`parseFloat('45000.70') * 100 === 4500069.999999999`), and wrong in a way that
reaches production as an occasional one-cent discrepancy nobody can reproduce.

### Wiring — and why it landed on the list, not the detail page

The ledger is reached from the tenant ROW ("Pagos" in the actions menu), not
from the tenant detail page. That was forced by a finding: `TenantDetailResponse`
carries **no human-readable tenant name** — its header renders a 5-character
code, and its own comment says a name "would be shown if one ever becomes
available". The record dialog names the agency being charged as its guard
against booking a payment against the wrong one, so mounting it where no name
exists would have silently removed that guard. The row has the name.

Delivered: `BillingCell` as a "Pago hasta" column in the tenant list,
`TenantPaymentsDialog` opened from the row menu, and `TenantPaymentsPanel`
owning both mutations with `useStepUpGate` retry wiring.

Console: **43 tests** in `features/payments`; full `viewpro-web` suite
**597 passing**; `tsc --noEmit` clean.

### Two real defects the typechecker caught during wiring

1. **`BigInt` literals do not compile in `viewpro-web`.** Its tsconfig targets
   **ES2017**, where `0n` is a syntax error, even though the `bigint` type and
   constructor are available under `lib: esnext`. Rewritten to `BigInt(0)` /
   `BigInt(10)`; the arithmetic is identical and the precision guarantee holds.
   Worth knowing before any other feature moves money through this app.
2. `useSession()` returns `{ session, isLoading, signOut }`, so the operator
   role is `session.session?.operator.role` — the first guess (`session.operator`)
   typechecked as an error rather than silently rendering `canReverse === false`
   and quietly hiding the reversal action from OWNER.

### On the pre-existing audit failure

After this wiring the full `viewpro-web` suite passes **597/597**, including
`audit-feed-page.spec.tsx > the clear affordance resets filters`, which failed
before. It was **not fixed** — it is order-dependent, and adding files changed
the execution order. It remains fragile and unrelated to payments.

### Pre-existing failure, not caused here

`viewpro-web`'s full suite has one failing test —
`audit-feed-page.spec.tsx > the clear affordance resets filters back to an empty request`.
Verified as pre-existing by stashing all changes and re-running: it fails on the
clean baseline too (553 passed / 1 failed). It passes when run in isolation, so
it is a cross-test isolation problem in that spec, unrelated to payments.

`pnpm --filter viewpro-web lint:strict` also fails on the baseline with **9
warnings**, none in `features/payments` — the same 9 before and after this work.

## PR 4 — Revenue visibility — **complete**

### RED/GREEN evidence

| Task | RED | GREEN |
|---|---|---|
| Revenue summary endpoint | 5 failing — route 404 | 6/6 passing |
| Overdue count | 4 failing — `countOverdue` absent | 5/5 passing |
| `RevenuePanel` | import failure | 8/8 passing |

Backend: **61 files, 559 tests**. Console: **605 tests**, tsc clean, no new lint
warnings (the same 9 pre-existing ones).

### The attribution rule is in the response, not just the docs

`GET /operators/revenue/summary` returns `attribution: 'RECORDED_AT'`, and the
panel renders that basis in words. Under manual billing an annual prepayment, or
August's transfer entered on September 2nd, makes "collected in August" and
"revenue for August" different numbers. A figure whose basis is unstated
eventually becomes a business decision made on the wrong reading, so the API
states which one it is rather than leaving it to whoever opens the page.

Totals never sum across currencies — each currency keeps its own month total,
because adding pesos to dollars produces a number that means nothing.

### The overdue count renders at zero

`Sin inmobiliarias vencidas` is shown rather than hiding the row. Hiding it
would make "nobody is overdue" and "the panel failed to load" look identical —
and since nothing suspends a lapsed tenant automatically, this count is the
only signal anyone stopped paying. A silent safety net is not a safety net.

Tenants that were never paid for are deliberately excluded from the count: they
were never due. Including them would put every trial signup into the alert, and
a counter that is permanently red is one nobody reads.

### Revenue is additive to the dashboard

The overview passes `revenue` as an optional prop and the page does not block on
it. If the revenue query fails the dashboard still renders its existing panels —
money should not be able to break the operator's overview.

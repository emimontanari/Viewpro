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

## PR 3 — Console surfaces — not started

## PR 4 — Revenue visibility — not started

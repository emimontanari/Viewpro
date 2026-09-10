# Design — issue599 owner denial retry and seeded polling

## Decision

Keep this frontend-only and query-local. Define one local `retryOwnerDetailRead` predicate in `features/owner/api/queries.ts`; it uses `isBffError` and returns `false` only when the error is a typed `BffError` with status `404`, otherwise returns `failureCount < 3`.
Apply it only to `ownerPropertyOptions` and `ownerPropertyEngagementsOptions`. Lists, timelines, documents, notifications, seller production queries, global defaults, backend behavior, and timeout budgets remain unchanged.

## Data flow

1. An affected owner query calls its existing service and BFF route.
2. React Query passes `(failureCount, error)` to the local predicate after failure.
3. A typed `BffError(404)` stops immediately and the existing safe error/not-found UI renders.
4. Any other typed status or error kind remains retryable while `failureCount < 3`, preserving at most three retries after the initial request.
5. Martin's existing seeded response handlers set session/products/activity flags; `expect.poll` waits for each explicit `true` before transformed-content assertions continue.

## Files and contracts

| File | Change |
|---|---|
| `.../src/features/owner/api/queries.ts` | Define the local predicate and set `retry` on `ownerPropertyOptions` and `ownerPropertyEngagementsOptions` only. |
| `.../src/features/owner/api/queries.test.ts` | Call both query-option retry callbacks across terminal and retry-boundary cases. |
| `.../tests/seeded/demo-smoke.spec.ts` | Poll Martin's three flags; preserve response/data/leak assertions. |

The predicate contract is `(failureCount: number, error: unknown) => boolean`; exact class identity matters, so generic errors follow the non-terminal branch. No response shape, query key, cache, UI contract, or seller retry behavior changes.

## Test design

- Both owner option callbacks return `false` for `new BffError(404)` at failure count `0`.
- Both callbacks return `true` for `BffError(403/500)` and plain `Error` at counts `0..2`, then `false` at `3`.
- Martin's seeded proof uses three separate `await expect.poll(() => flag).toBe(true)` checks under the existing timeout; successful real response and authorized-content checks stay intact.
- Existing seeded direct-denial assertions retain safe error/not-found states and absent denied titles; no additional request-count interception is introduced.

## Verification and rollout

Run the focused owner query-option Vitest file, frontend typecheck and lint, then the targeted Martin and isolation seeded Playwright cases when its database-backed environment is available. Confirm no timeout, backend, BFF, global QueryClient, seller production query, or unrelated owner-query diff. This is an immediate frontend rollout with no migration or feature flag.

## Risks and rollback

A cross-realm or reconstructed `404` is intentionally retryable because only typed `BffError` is trusted; callback coverage guards that boundary. Failure-count semantics could cause an off-by-one, so tests pin counts `0..3`. Polling can still fail on a missing interception, as intended, within the current budget. Roll back by removing the two scoped `retry` assignments/local predicate and restoring direct flag assertions; no data repair or backend rollback is needed.

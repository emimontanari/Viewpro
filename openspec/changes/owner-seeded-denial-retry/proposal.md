# Proposal — Owner-seeded denial retry hardening

## Intent

Stop authorization-shaped `404` responses from being retried on the owner property and owner property-engagements detail reads. These denials are terminal for the current request, but the affected queries inherit three retries, delaying the honest error state and adding redundant traffic. Separately, remove a race in Martin's seeded seller-home proof by polling the session, products, and activity interception flags instead of asserting them synchronously.

## Scope

### In scope

- Add a local owner-query retry predicate for the owner property and owner property-engagements reads only.
- Treat only typed `BffError` responses with status `404` as terminal and perform no retry for them.
- Preserve the existing three-retry behavior for every other failure handled by these owner queries.
- Add focused owner query-option callback coverage for terminal `404` behavior and unchanged retry allowance for other failures.
- Change Martin's seeded seller-home race assertions to `expect.poll` for the session, products, and activity interception flags.

### Out of scope

- Timeout increases or other timing-budget changes.
- Changes to the global query retry policy.
- Seller production query retry behavior.
- Backend, BFF route, authentication, authorization, API contract, or schema changes.
- Broader retry classification, status handling, seeded-test refactoring, or product behavior changes.

## Approach

Use one local owner-query predicate in `features/owner/api/queries.ts` and apply it only to the two owner detail reads. It inspects the existing typed `BffError`: status `404` returns immediately as non-retryable, while all other errors retain the current maximum of three retries. This preserves resilience for transient failures without repeatedly issuing requests that the current owner cannot resolve.

For Martin's seeded seller-home proof, keep the existing route interception and response assertions intact, but poll each interception flag. This synchronizes the existing asynchronous proof without changing seller query retry behavior, timeouts, or authorized-data checks.

## Affected areas

| Area | Impact |
|---|---|
| `viewpro-app/apps/app-new/src/features/owner/api/queries.ts` | Apply terminal-`404` retry behavior to owner property and owner property-engagements reads. |
| `viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts` | Prove both option callbacks stop typed `404` retries and retain retries for other failures. |
| `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` | Poll Martin's session, products, and activity interception flags. |

## Risks and mitigations

- **Risk:** The predicate could accidentally suppress retries for transient or unrelated errors. **Mitigation:** Match only typed `BffError` instances whose status is exactly `404`, with focused boundary tests for `404` and non-`404` failures.
- **Risk:** Retry counts could drift from the current behavior. **Mitigation:** Encode and test the existing three-retry limit for all non-terminal failures rather than changing the global policy.
- **Risk:** Polling could hide an interception that never occurs. **Mitigation:** Poll the boolean flags to the explicit successful value; a missing interception still fails within the existing test budget.

## Rollback

Revert the two scoped retry assignments/local predicate and restore Martin's direct flag assertions. No migration, backend rollback, configuration change, or data repair is required.

## Success criteria

- Owner property and owner property-engagements queries make no retry after a typed `BffError` with status `404`.
- The same owner queries continue to permit the existing three retries for all other failures.
- No global retry policy, seller production query retry behavior, or timeout changes.
- Martin's seeded seller-home proof waits for all three interception flags with `expect.poll` and still fails when any interception does not complete.
- The implementation plan remains a single reviewable work unit under 400 changed lines in total.

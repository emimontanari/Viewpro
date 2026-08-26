# Production Cutover Session and Rollback Specification

## Purpose

Define which sessions a cutover invalidates, which lane it deliberately leaves alone, and when a URL reversal is refused.

## Named Threat Contracts

These identifiers are referenced by task 4.1 and are restated here because the design table that defined them was removed by `e083fc3`; they are recovered from `800d1a3`. Each names one hostile case a test MUST prove fails closed.

| ID | Module | Failure oracle |
|---|---|---|
| RED-CUT-12 | `rollback.mjs` † | post-write URL reversal refused |
| RED-CUT-13 | `apps/{api,viewpro-api}/test/production-cutover-session.spec.ts` | every old session or token rejected |

† The recovered row names `checkpoint.mjs`. That module merged with work unit four, carries no notion of a business-write boundary or a reversal direction, and lies outside this work unit's paths — the same mismatch RED-CUT-11 hit, resolved the same way. The refusal therefore lives in its own module. That module is an additive path: the work unit's declared file list does not name it, and this document is where the addition is recorded, as work unit three did for continuous integration and work unit six for the backup workflow. A threat contract enforced by nothing but prose is not enforced at all.

## Requirements

### Requirement: Rotation Invalidates Every Old Session

A cutover abandons the product database, which destroys the refresh, reset and verification rows stored there. It does not destroy a signed access token, because verifying one reads no database. Every old session MUST therefore be invalidated by rotating the signing secrets: the product access secret, the platform access secret, and the platform step-up secret. A token signed under a retired secret MUST fail verification under the current one, and a guard MUST refuse it with its own coded rejection rather than a generic error.

Rotation MUST be coordinated across every consumer of a rotated secret, not merely the backend that mints tokens. The product access secret is read by the product backend, by the frontend proxy that verifies the access cookie itself, by the platform's outbound clients, and by local document-storage URL signing — so rotating it also invalidates every outstanding signed document link. That consequence MUST be stated to the operator before the rotation rather than discovered after it.

Judgement MUST be made through the deployed token service and guards rather than a substitute, because a test that mints and verifies with its own key proves only that the signing library works and would pass unchanged against a service that had stopped verifying signatures altogether.

#### Scenario: A token signed under a retired secret is rejected (RED-CUT-13)
- GIVEN a product access token, a platform access token, or a platform step-up token signed under the previous generation's secret
- WHEN it is verified under the current generation's secret
- THEN verification fails and the guarding layer refuses the request with its coded rejection

#### Scenario: A database-backed token is rejected once its row is gone
- GIVEN a refresh, reset or verification token whose stored row no longer exists
- WHEN it is presented
- THEN it is rejected, because the lookup that would authorise it finds nothing

#### Scenario: A token from a generation that predates a required claim is rejected
- GIVEN a platform access token whose session expiry claim is absent, or present but not a finite number
- WHEN it is presented
- THEN it is rejected rather than treated as unexpiring

#### Scenario: A rejected session keeps no cookie
- GIVEN any refusal by the platform access guard
- WHEN the response is inspected
- THEN both the access and step-up cookies are cleared, so the next request presents neither

### Requirement: The Control Lane Is Not Rotated

The platform control secret authenticates a backend-to-backend lane, not a human session. It MUST NOT be rotated by a cutover, because rotating it introduces a cross-backend atomicity dependency that the cutover has no way to satisfy. Rotating the session secrets MUST therefore leave control-lane tokens valid, and a session token MUST never authenticate as a control-lane token, in either direction.

#### Scenario: Control-lane tokens survive a session rotation
- GIVEN a control-lane token signed under the unrotated control secret
- WHEN the session secrets are rotated
- THEN the control-lane token still verifies

#### Scenario: Lanes never authenticate for each other
- GIVEN a token minted for one lane, carrying whatever issuer, audience and identifier that lane requires
- WHEN it is verified by the other lane's own verifier
- THEN verification fails in both directions, on that verifier's own requirements rather than merely on a differing key

### Requirement: Post-Write URL Reversal Refused

Before the first business write, the previous generation may be restored. After one, a URL reversal MUST be refused unless reconciliation or export authority is presented, because the two generations have diverged and reversing the address silently discards whatever was written. Rolling forward is the default. Authority MUST be judged as present, unexpired, and bound to the generation it licences, never merely declared: an authority naming no generation is a bearer grant good for any reversal, and an expiry far enough away is a standing licence rather than a grant scoped to one cutover. A reversal MUST also be refused when the write boundary is unknown, because an unknown boundary is not evidence that no write occurred.

The write boundary is an attested input, not a determination this module makes. It refuses a boundary that is unknown and demands authority for one that declares itself post-write, but a record that declares itself pre-write is credited on that declaration alone.

#### Scenario: Reversal after a business write refused (RED-CUT-12)
- GIVEN a reversal requested after the first business write, with no reconciliation or export authority
- WHEN the request is evaluated
- THEN it is refused and names what was missing

#### Scenario: Reversal before any business write permitted
- GIVEN a reversal requested while no business write has occurred and containment still holds
- WHEN the request is evaluated
- THEN it is permitted, and reports no authority of its own

#### Scenario: Unknown or unproven state refused
- GIVEN a reversal whose write boundary is unknown, or whose authority is absent, expired or malformed
- WHEN the request is evaluated
- THEN it is refused rather than credited

### Requirement: Identity Only, Never An Instance

This work unit commits tooling, tests, schemas, unpopulated templates and prose. A populated evidence instance MUST NOT enter Git. No real secret value, secret fingerprint, host, role name, project identifier, connection string or provider response may appear in any committed file or in any result: tests MUST use placeholder secrets, and a denial MUST name a closed-vocabulary token or a position rather than a caller-supplied value, and that vocabulary MUST be published so a caller can verify it is closed. A synthetic hostile fixture used to prove non-leakage is not itself a leak. Every result MUST report authority as denied.

#### Scenario: Authority denied
- GIVEN any rollback outcome, permitted or refused
- WHEN the result is inspected
- THEN authority is denied and no external state has changed

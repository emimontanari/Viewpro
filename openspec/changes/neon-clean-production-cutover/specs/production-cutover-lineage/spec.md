# Production Cutover Lineage Specification

## Purpose

Govern cutover without redefining #327.

## Requirements

### Requirement: Clean Bootstrap Allowlist

New generation MUST contain only allowlisted state. Product: migration ledger/schema only; no users/tokens/tenants/memberships/business/document/notification/outbox/command/payment rows or demo seed. Platform: ledger/schema, cursor `0`, one authorized operator, no mirror/registry/audit/business rows, and valid empty metrics. No old row MAY be imported/restored. Provisioning MUST await receipts for current-organization slots, independent Free allowance, and provider policy; paid plans/unapproved organizations are prohibited.

#### Scenario: Bootstrap passes
- GIVEN fresh product and platform projects
- WHEN the allowlist receipt is evaluated
- THEN zero invariants, cursor `0`, operator count, and empty metrics pass; no old/demo row exists

#### Scenario: Provisioning blocked
- GIVEN a slot, allowance, or policy receipt is absent
- WHEN provisioning is requested
- THEN provisioning and traffic fail closed

### Requirement: Role and Lane Isolation

Each lane MUST use privileged direct migration/bootstrap, least-privilege pooled runtime, read-only direct backup identities. Production/demo endpoints MUST differ. Any default-owner exception MUST be documented, approved, time-bounded.

#### Scenario: Lane manifest
- GIVEN a receipt lists roles, targets, grants, and any owner exception
- WHEN activation is evaluated
- THEN it passes only for distinct endpoints and a current approved exception

### Requirement: Generation Identity and Pre-Traffic Authority

A redacted receipt MUST bind image, endpoints, backup lineage, secret fingerprints, deployment, rollback target, exact active #327 candidate. Fresh traffic MUST await #327 pre-production proof/alerts, D.1-D.2 reconfirmation, D.4, readiness, singleton, non-timer/non-stale image. Non-atomic changes MUST fail closed.

#### Scenario: Candidate gate failure
- GIVEN any binding, proof, alert, readiness, singleton, or image check fails
- WHEN fresh traffic is requested
- THEN admission fails; projects remain isolated

### Requirement: Ordered Cutover and Session Invalidation

Cutover MUST readiness-gate product then platform backends, then frontends, rejecting cross-generation writes. It MUST invalidate product JWTs/cookies, platform JWTs/step-up tokens, and abandoned DB-backed refresh/reset/verification tokens. `PLATFORM_CONTROL_SECRET` MUST stay unchanged unless separately authorized.

#### Scenario: Promotion and invalidation
- GIVEN each predecessor is ready and old artifacts exist
- WHEN sequence and invalidation checks complete
- THEN only the next layer receives traffic; old artifacts are rejected; no cross-generation write is accepted

### Requirement: Rollback and Retention Boundary

Before first business write, paired old image and URLs MAY return. Later URL rollback MUST be forbidden without reconciliation/export authority; roll-forward is default. Old Neon projects/backups MUST remain one month. R2 business objects, Sentry, and Resend MUST NOT be deleted or receive a new retention policy.

#### Scenario: Boundary protection
- GIVEN a business write occurred or retention is active
- WHEN unauthorized rollback or deletion is requested
- THEN the request is refused; retained lineage is protected

### Requirement: Backup Lineage and Evidence Gates

New generation MUST have generation-specific backup lineage plus successful backup/heartbeat before maintenance ends; pruning MUST NOT remove old-generation rollback artifacts during the month. The 24-hour internal pilot MUST reference a passing #327 D.5 receipt without redefining D.5 and MUST NOT authorize public launch. One-month evidence MUST record per-project raw CU, autosuspension, scheduled activity, demand history, and generation identity; it only informs the commercial decision and authorizes no paid plan, public launch, deletion, or broader release.

#### Scenario: Evidence incomplete
- GIVEN a requested progression lacks its corresponding receipt
- WHEN the receipt gate is evaluated
- THEN a missing fresh-lane backup or heartbeat MUST block maintenance completion and write resumption
- AND a missing #327 D.5 receipt MUST block the internal pilot and #327 verify/archive
- AND missing one-month or retention evidence MUST block the commercial decision and cutover verify/archive
- AND a missing later receipt MUST NOT retroactively block an earlier progression whose receipt gate was already satisfied

### Requirement: Lifecycle Order

#327 MUST remain active through cutover; D.5 follows deployment; #327 verify/archive follows D.5; cutover verify/archive follows #327 plus month and retention gates.

#### Scenario: Receipt order
- GIVEN a predecessor receipt is missing
- WHEN verify/archive is requested
- THEN it is blocked

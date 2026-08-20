# Production Cutover Lineage Specification

## Purpose

Govern cutover without redefining active #327 authority.

## Requirements

### Requirement: Clean Bootstrap Allowlist

The new generation MUST contain allowlisted state only. Product MUST have migration ledger/schema only and zero users/tokens/tenants/memberships/business/document/notification/outbox/command/payment rows, with no demo seed. Platform MUST have migration ledger/schema, cursor `0`, exactly one authorized operator, zero mirror/registry/audit/business rows, and valid empty metrics. No old row MAY be imported or restored. Provisioning MUST wait for receipts proving current-organization slots, independent Free allowance, and provider policy; paid plans and unapproved organizations are prohibited.

#### Scenario: Bootstrap passes
- GIVEN fresh product and platform projects
- WHEN the allowlist receipt is evaluated
- THEN zero invariants, cursor `0`, operator count, and empty metrics pass; no old/demo row exists

#### Scenario: Provisioning blocked
- GIVEN a slot, allowance, or policy receipt is absent
- WHEN provisioning is requested
- THEN provisioning and traffic fail closed

### Requirement: Role and Lane Isolation

Each product/platform lane MUST use privileged direct migration/bootstrap, least-privilege pooled runtime, and read-only direct backup identities. Production and demo endpoints MUST differ. Any provider-default-owner exception MUST be documented, approved, and time-bounded.

#### Scenario: Lane manifest
- GIVEN a receipt lists roles, targets, grants, and any owner exception
- WHEN activation is evaluated
- THEN it passes only for distinct endpoints and a current approved exception

### Requirement: Generation Identity and Pre-Traffic Authority

A redacted receipt MUST bind image, pooled/direct endpoints, backup lineage, secret versions/fingerprints, deployment, rollback target, and exact active #327 candidate. Fresh traffic MUST wait for #327 pre-production proof/alert receipts, D.1-D.2 reconfirmation, D.4 receipts, readiness, singleton, and a non-timer-bearing, non-stale image. Non-atomic secret/deployment changes MUST fail closed.

#### Scenario: Candidate gate failure
- GIVEN any binding, proof, alert, readiness, singleton, or image check fails
- WHEN fresh traffic is requested
- THEN admission fails; projects remain isolated

### Requirement: Ordered Cutover and Session Invalidation

Cutover MUST readiness-gate product backend, then platform backend, then frontends; it MUST reject cross-generation writes. It MUST invalidate product access JWTs/cookies, platform access JWTs/step-up tokens, and DB-backed refresh/reset/verification tokens abandoned with their rows. `PLATFORM_CONTROL_SECRET` MUST stay unchanged unless separately authorized.

#### Scenario: Promotion and invalidation
- GIVEN each predecessor is ready and old artifacts exist
- WHEN sequence and invalidation checks complete
- THEN only the next layer receives traffic; old artifacts are rejected; no cross-generation write is accepted

### Requirement: Rollback and Retention Boundary

Before the first business write, paired old image and URLs MAY return. Afterward, URL rollback MUST be forbidden without reconciliation/export authority; roll-forward is default. Old Neon projects and old-generation backups MUST remain at least one month. R2 business objects, Sentry, and Resend MUST neither be deleted nor receive a new retention policy from this change.

#### Scenario: Boundary protection
- GIVEN a business write occurred or retention is active
- WHEN unauthorized rollback or deletion is requested
- THEN the request is refused; retained lineage is protected

### Requirement: Backup Lineage and Evidence Gates

The new generation MUST have generation-specific backup lineage, one successful backup and heartbeat before maintenance ends; pruning MUST NOT remove old-generation rollback artifacts during the month. The 24-hour internal pilot MUST reference a passing #327 D.5 receipt without redefining D.5 and MUST NOT authorize public launch. One-month evidence MUST record per-project raw CU, autosuspension, scheduled activity, demand history, and generation identity; it only informs a separate commercial decision and authorizes no paid plan, public launch, deletion, or broader release.

#### Scenario: Evidence incomplete
- GIVEN backup, heartbeat, retention, D.5, or month evidence is absent
- WHEN progression is requested
- THEN maintenance, pilot, and broader authority stay blocked

### Requirement: Lifecycle Order

#327 MUST remain active through cutover; D.5 MUST occur after deployment; #327 verify/archive MUST follow D.5; cutover verify/archive MUST follow #327 plus month and retention gates.

#### Scenario: Receipt order
- GIVEN a predecessor receipt is missing
- WHEN verify/archive is requested
- THEN it is blocked

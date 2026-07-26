<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/stage-26-2-deterministic-seed-contract (delta dated 2026-06-14) -->

# Deterministic Demo Seed Specification

## Purpose

Ensure the demo/pilot seed produces a safe, repeatable fixture dataset for Stage 26.2 evidence while preserving production data behavior and leaving full seeded workflow choreography to Stage 26.3.

## Requirements

### Requirement: Demo Seed Safety and Idempotence

The demo seed MUST refuse production execution, MUST require a safe database target or deliberate non-production override, and MUST mutate only canonical demo-owned fixture data. Re-running the seed MUST produce the same semantic fixture set without duplicate demo rows or unrelated data changes.

#### Scenario: Unsafe target is blocked before mutation

- GIVEN `NODE_ENV=production`, a missing database URL, or a non-production database URL that is not recognized as local/dev/test and has no deliberate unsafe-target override
- WHEN the demo seed is invoked
- THEN the seed fails before writing data
- AND the failure explains the guard reason without logging secrets.

#### Scenario: Safe rerun is deterministic and scoped

- GIVEN a safe local/dev/test database already contains prior demo seed data and unrelated tenant data
- WHEN the demo seed runs twice
- THEN both successful runs report the same demo fixture keys, counts, and states
- AND no unrelated tenant, user, property, document, notification, contact, or admin data is deleted or changed.

### Requirement: Stable Demo Personas and Credentials

The demo seed MUST define stable demo identities for a tenant manager, one or more seller personas, an owner persona, and a ViewPro admin persona. Each persona MUST have deterministic account identifiers, names, roles, activation/verification state, and credential expectations suitable for seeded evidence. Logs MAY describe a default local demo password, but MUST NOT reveal an environment-supplied secret.

#### Scenario: Personas are available for evidence

- GIVEN the demo seed has completed successfully
- WHEN the seeded account contract is inspected
- THEN it includes a manager persona for tenant administration proof
- AND it includes seller personas sufficient to prove assignment scope and contact branches
- AND it includes an owner persona linked to owner-portal proof data
- AND it includes a ViewPro admin persona with global admin access
- AND each listed persona has a stable login identifier and documented credential behavior.

### Requirement: Product Story Fixtures Cover Stage 26.2 Evidence

The demo seed MUST create deterministic Stage 26.2 evidence anchors for properties, property images, assigned sellers, owner access, movements/Seguimiento activity, document requests, document upload/review states, and owner invitation context. Smoke-critical image and document assets MUST be deterministic and MUST NOT silently reduce required fixture counts when an external asset source is unavailable.

#### Scenario: Seeded story data is complete enough for role proof

- GIVEN the demo seed has completed successfully
- WHEN the seeded fixture contract is checked
- THEN at least one manager-visible property portfolio anchor exists
- AND at least one seller-assigned property anchor exists for each seller path used by the smoke proof
- AND at least one owner-linked property anchor exists for owner-portal proof
- AND property image counts meet the contract for smoke-critical properties
- AND movement/activity records exist for Seguimiento evidence
- AND document request, upload, and review-state anchors exist for document evidence.

### Requirement: Notification Fixtures Are Routed and Stateful

The demo seed MUST include deterministic notification fixtures for owner and internal surfaces. Each seeded notification surface MUST include read and unread states, safe relative links for that surface, and references only to seeded tenant-owned entities that the recipient is allowed to access.

#### Scenario: Owner notification fixtures are safe

- GIVEN the owner persona is authenticated after the demo seed
- WHEN owner notification fixtures are inspected
- THEN at least one read and one unread owner notification exist
- AND each owner notification link is a safe relative `/owner...` link
- AND no owner notification link is external, protocol-relative, malformed, or dashboard-only
- AND each referenced property, document, movement, or engagement belongs to seeded owner-accessible data.

#### Scenario: Internal notification fixtures are safe

- GIVEN a seeded internal tenant persona is authenticated after the demo seed
- WHEN internal notification fixtures are inspected
- THEN at least one read and one unread internal notification exist
- AND each internal notification link stays within dashboard/internal route space
- AND no internal notification link is external, protocol-relative, malformed, or owner-only
- AND each referenced entity belongs to the seeded demo tenant and allowed recipient scope.

### Requirement: Contact Fixtures Cover Seller, Tenant, and No-Config Paths

The demo seed MUST provide deterministic contact fixtures that prove seller-specific contact, tenant fallback contact, and an explicit no-config contact state without depending on production configuration or external WhatsApp delivery. Contact values used by the seed MUST be clearly demo-only.

#### Scenario: Contact resolution paths are provable from seed data

- GIVEN the demo seed has completed successfully
- WHEN contact behavior is checked for seeded owner/property paths
- THEN one path resolves to a configured seller contact
- AND one path resolves to a configured tenant contact fallback
- AND one path resolves to an explicit no-config state instead of a fake production contact
- AND no proof path requires manual database edits, production contact data, or external message delivery.

### Requirement: Admin and Limit Fixtures Are Deterministic

The demo seed MUST include admin-visible tenant control data for the demo tenant, including deterministic tenant status, limit configuration, and usage/count context sufficient for Stage 26.2 admin evidence. Tenant personas MUST NOT gain ViewPro admin capability through the seed unless explicitly listed as the ViewPro admin persona.

#### Scenario: ViewPro admin can inspect seeded tenant control state

- GIVEN the ViewPro admin persona is authenticated after the demo seed
- WHEN the seeded demo tenant is inspected through admin-visible data
- THEN the tenant has a deterministic status for the contract
- AND the tenant has deterministic limit values and usage/count context
- AND tenant manager, seller, and owner personas do not receive global admin access as a side effect.

### Requirement: Seed Run Emits a Clear Contract Summary

A successful demo seed run MUST emit a clear human-readable contract summary that identifies the demo tenant, seeded personas, tenant status/limits, contact fixtures, notification fixtures, product-story fixture counts, asset strategy, and smoke-proof anchors. The summary MUST be stable enough for Stage 26.2 evidence and MUST redact non-default secrets.

#### Scenario: Summary can be used as Stage 26.2 evidence

- GIVEN the demo seed succeeds
- WHEN the run output is reviewed
- THEN it states the demo tenant identity and safety scope
- AND it lists seeded personas and credential behavior without leaking environment-supplied secrets
- AND it reports expected counts/states for properties, images, movements, documents, notifications, contact fixtures, and admin/limit data
- AND rerunning the seed produces the same semantic summary for contract fields.

### Requirement: Focused Seeded Smoke Proves the Contract Boundary

Stage 26.2 seeded smoke MUST prove the deterministic seed contract without becoming the full Stage 26.3 end-to-end choreography. The smoke proof MUST cover the seeded contract anchors for manager, seller, owner, ViewPro admin, properties, images, movements, documents, notifications, contact, and limits, while broad manager-to-seller-to-owner-to-admin workflow choreography remains Stage 26.3.

#### Scenario: Focused smoke validates contract anchors

- GIVEN the demo seed has completed successfully
- WHEN the Stage 26.2 seeded smoke runs
- THEN it validates the seed summary or equivalent contract evidence
- AND it proves representative manager, seller, owner, and ViewPro admin access to their seeded anchors
- AND it proves seeded property images, movement/activity, document states, notification read/unread plus safe links, contact priority/no-config behavior, and admin status/limits fixtures
- AND it does not require executing the full Stage 26.3 workflow choreography.

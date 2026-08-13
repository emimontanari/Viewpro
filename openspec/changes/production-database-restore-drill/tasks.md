# Tasks: Production Database Restore Drill

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 430–650 public lines; raw logs out of Git |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 planning → PR2 execution/docs/receipt |
| Delivery strategy | ask-on-risk, resolved by maintainer |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Publish planning-only OpenSpec artifacts | PR1 | `develop`; #290 reference; no access/closure |
| 2 | Execute lanes and publish evidence | PR2 | After PR1 and access/quota; fresh `develop`; raw logs out |

**Resolved chain:** Sequential PRs target `develop`; no feature tracker/size exception.
**Hard gate:** PR2 does not exist/start until PR1 merges, least-privilege Neon/R2 access and two-project quota are approved, and evidence/target checks pass.
**Issue closure:** PR1 MUST NOT close #290. PR2 may close it only after both lanes, sanitized evidence, cleanup, revocation, runbook/ledger reconciliation, and next-drill scheduling pass.
**Dependency:** PR1 (`develop`) 📍 → PR2 (`develop`, fresh base after merge).

## Phase 1: Provisioning, Safety, and Evidence Gates

- [ ] 1.1 In PR1, finalize gate: require Neon quota, least-privilege Neon/R2 access, revocation owner/deadline, no secret values; do not connect.
- [ ] 1.2 In PR2, add fail-closed preflight for `.github/workflows/db-backup.yml`: metadata, age/checksum/gzip/SQL checks, read-only source, allowlisted targets, production denylist, inequality, PostgreSQL compatibility, aborts.
- [ ] 1.3 In PR2, add the redacted receipt template and UTC/monotonic dump age/RPO, RTO, validation, teardown, total definitions; prohibit URLs, secrets, rows, identifiers, payloads, money, raw SQL.

## Phase 2: Independent Restore and Validation

- [ ] 2.1 In PR2, restore `inmoview-prod/` into a temporary Neon project with destination-only credentials; prove `apps/api/prisma/{schema.prisma,migrations/}` parity, aggregates, tenant/relational invariants, outbox/command checks.
- [ ] 2.2 In PR2, restore `viewpro-platform-prod/` into a distinct temporary Neon project; prove `apps/viewpro-api/prisma/{schema.prisma,migrations/}` parity, operator/aggregate/payment invariants, mirror/change-feed uniqueness, and cursor checks.
- [ ] 2.3 In PR2, compare lanes only with salted IDs/hashes, mismatch counts, booleans, status/limits, cursor bounds, event uniqueness, and audit-only exclusion; record no raw identifiers.

## Phase 3: Cleanup, Evidence, and Reconciliation

- [ ] 3.1 In PR2, run finally-style cleanup: remove targets/files, verify absence, revoke Neon/R2 credentials, verify revocation, and retry idempotently.
- [ ] 3.2 In PR2, after redaction review, create `openspec/changes/production-database-restore-drill/evidence/restore-drill-receipt.md`; keep raw logs/dumps outside Git.
- [ ] 3.3 In PR2, update `docs/plans/2026-07-20-recta-final-execution.md` and runbook from stale language to backup mechanism, result, quarterly cadence, RPO/RTO, escalation, and next date.

## Phase 4: Verification and Closure

- [ ] 4.1 In PR2, verify all 13 scenarios: isolated/unsafe preflight; qualifying/stale-corrupt inputs; RTO pass/fail; structural/invariant pass/fail; projection agree/disagree; safe evidence; successful/failed teardown.
- [ ] 4.2 In each PR, review its diff; in PR2 verify redaction, isolation, and Git history contain no credentials, dumps, or prohibited output.
- [ ] 4.3 PR1 may merge while referencing #290 but MUST NOT close it; PR2 may close #290 only after both lanes, sanitized evidence, cleanup, revocation, runbook/ledger reconciliation, and next-drill scheduling pass; otherwise retain truthful failure.

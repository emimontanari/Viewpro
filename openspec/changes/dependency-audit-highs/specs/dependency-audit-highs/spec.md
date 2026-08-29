# Dependency Audit Highs Specification

## Purpose

Define the dependency-only remediation authorized by issue #310. The change MUST restore the production audit gate without changing product behavior or upgrading parent packages.

## Requirements

### Requirement: Patched transitive resolutions stay within parent ranges

The dependency tree MUST resolve `fast-uri` to `3.1.5` through Ajv's existing `^3.0.1` range and `nanoid` to `3.3.18` through PostCSS's existing `^3.3.16` range. The manifest and lockfile MUST NOT use an unsafe cross-major `fast-uri` override.

#### Scenario: Target resolutions are selected

- GIVEN the approved dependency manifests and targeted lock refresh
- WHEN the resolved dependency tree is inspected
- THEN Ajv remains on its existing versions, PostCSS remains `8.5.23`, `fast-uri` is `3.1.5`, and `nanoid` is `3.3.18`

#### Scenario: Cross-major or stale resolution remains

- GIVEN any `fast-uri` 4.x resolution, stale `3.1.3` or older resolution, or cross-major override
- WHEN the candidate is reviewed
- THEN the candidate MUST be rejected

### Requirement: Production high-severity audit is a blocking gate

The CI production dependency audit gate MUST report zero high-severity findings and MUST succeed at `pnpm audit --prod --audit-level high`. Low runtime exploit relevance MUST NOT waive this gate.

#### Scenario: Audit is clean at the required threshold

- GIVEN the patched lockfile and a production dependency graph
- WHEN the required audit command runs from `viewpro-app`
- THEN it exits successfully with no high-severity findings

#### Scenario: Runtime relevance is assessed as low

- GIVEN an advisory is classified as build-tool-only or low direct runtime relevance
- WHEN the audit still reports it at high severity
- THEN the change remains blocked until the audit command succeeds

### Requirement: Apply scope excludes unrelated dependency churn

The unified PR MUST contain exactly the five planning artifact files under `openspec/changes/dependency-audit-highs/` plus `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`, and MUST link issue #310 with `Closes #310`. Within that PR, only the two dependency files MAY be non-planning changes. The candidate MUST stay within the single-PR 400 changed-line review budget and MUST reject parent upgrades, importer movement, unrelated lockfile churn, and broad deduplication.

#### Scenario: Targeted two-file diff is produced

- GIVEN a unified candidate containing the five planning artifacts and a dependency remediation diff
- WHEN changed paths, parent versions, importer entries, and changed-line count are reviewed
- THEN the overall file list contains exactly seven approved files, the dependency sub-boundary contains only the two approved dependency files, parents remain unchanged, and the budget is not exceeded

#### Scenario: Resolver creates unrelated churn

- GIVEN a lockfile diff containing non-target package movement, parent upgrades, importer changes, or dedupe churn
- WHEN the diff is reviewed
- THEN the candidate MUST be rejected rather than normalized by a broader update

### Requirement: Verification is deterministic and complete

Exception #6840 permits #310 before #311 only if the candidate passes frozen install, target resolution checks, production audit, build, typecheck, lint, and the exact mandatory CI serial topology: both test databases migrated, then `pnpm exec turbo run test --concurrency=1`, using the pinned pnpm version and lockfile; the stronger concurrent uncached zero-retry harness is #311 acceptance.

#### Scenario: Full verification sequence passes

- GIVEN a clean candidate checkout
- WHEN frozen install, both target `pnpm why --recursive` checks, audit, build, typecheck, lint, both migrations, and `pnpm exec turbo run test --concurrency=1` run once
- THEN every command exits successfully, evidence identifies the patched target versions, and a NEW final verify report retains #6786 as historical FAIL

#### Scenario: Frozen or repository verification fails

- GIVEN any required command fails or resolution evidence is non-deterministic
- WHEN eligibility for merge is evaluated
- THEN the candidate MUST remain unmerged; manual rerun-until-green, skipped/weakened audit, and test-retry exceptions are prohibited

### Requirement: Rollback preserves the gate and unblocks PR #309 only after remediation

If compatibility verification fails, rollback MUST revert both approved dependency files together and pause the merge. Such rollback is not a successful steady state because it restores the red audit gate. After #310 merges green under #6840, #311 MUST proceed PR0→PR1→PR2, then #309/#308 MUST refresh before #284 continues.

#### Scenario: Compatibility failure requires rollback

- GIVEN build, typecheck, lint, or test failure after the dependency update
- WHEN rollback is performed
- THEN both dependency files are reverted together, no unrelated files are changed, and merge remains paused

#### Scenario: Remediation reaches develop

- GIVEN #310 has merged with a passing audit and verification evidence
- WHEN PR #309 is refreshed against `develop`
- THEN its checks MUST be rerun before PR #309 is considered unblocked

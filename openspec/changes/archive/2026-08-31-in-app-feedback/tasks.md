# In-App Feedback Implementation Tasks

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Planning chain: 165–370 per artifact; source chain: 300–390 per unit; verification evidence: 80–140 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | P1 proposal → P2 spec → P3 design → P4 tasks → S1 quota → S2 durable API → S3 notification/config → S4 BFF provenance → S5 floating UI → V1 verification |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main label, operationally sequential integration to `develop` |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

The chain strategy label above is overridden by the repository authority: `develop` is the canonical base and every PR targets `develop`; after each predecessor merges, refresh `origin/develop` and create the next worktree/branch from it. No branch-stacked child PRs and no PR targets `main`. Each planning or source unit is independently reviewable and revertible, with a hard cap below 400 changed lines including tests, migration, `tasks.md`/`apply-progress.md` updates, and other OpenSpec evidence.

## Execution contract

- Commands below run from `viewpro-app/` and use `pnpm`. In every fresh worktree run `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts build`, and `pnpm db:generate` before focused tests.
- API database tests MUST use `viewpro_test` or a clearly test-marked per-worker database through `DATABASE_URL`; never use development or production data. Real PostgreSQL is required for advisory-lock/concurrency claims.
- Strict TDD order is RED → GREEN → TRIANGULATE → REFACTOR. Tests stay with the behavior; no test-only, model-only, or file-type-only source unit is permitted.
- Generated Prisma migration SQL is a visible reviewed change. Preserve the exact advisory-lock rolling limit, both tenant-owned models, durable-before-email ordering, sanitized notifier, production fail-fast configuration, mount/unmount request-ID clearing, status/errorCode-only UI branching, icons registry, and floating layout entry.
- SDD apply performs no commit, push, PR creation, merge, or publication. RDD review is a separate pre-commit gate and follows native `status --next-transition` only.

## Sequential planning delivery

### P1 — Deliver the approved proposal

- [x] Deliver the existing approved proposal as a planning-only PR before the spec PR. <!-- sdd-owner: implementation -->
- Objective: publish `openspec/changes/in-app-feedback/proposal.md` unchanged as the intent and non-goal boundary.
- Dependencies: none; base the worktree on refreshed `origin/develop`.
- Allowed paths: `openspec/changes/in-app-feedback/proposal.md` only; no source, tests, spec, design, config, or planning-evidence edits.
- TDD/guard mutation: not applicable to a planning-only artifact; no product guard is changed.
- Verification: RED/GREEN/TRIANGULATE/REFACTOR are not run; run `pnpm --filter @viewpro/api db:validate` only if the repository requires a docs-PR baseline, plus `git diff --check`. Expected result is clean documentation validation.
- Forecast/rollback: approximately 165 proposal-artifact lines, hard cap 180; revert this planning PR without touching product code.
- Done: proposal scope, audience, privacy, rollback, strict-TDD expectation, and issue #307 exclusions remain intact.

### P2 — Deliver the approved specification

- [x] Deliver the existing approved specification as a second planning-only PR after P1 merges. <!-- sdd-owner: implementation -->
- Objective: publish `openspec/changes/in-app-feedback/specs/authenticated-feedback-submission/spec.md` as the testable capability contract.
- Dependencies: P1 merged; refresh from `origin/develop` and target `develop`.
- Allowed paths: `openspec/changes/in-app-feedback/specs/authenticated-feedback-submission/spec.md` only; do not edit proposal, design, tasks, source, tests, config, or planning evidence.
- TDD/guard mutation: not applicable; no product guard is changed.
- Verification: no RED/GREEN product run; run `git diff --check` and inspect requirement/scenario coverage. Expected result is the approved 370-line spec with no scope drift.
- Forecast/rollback: approximately 370 specification-artifact lines, hard cap 395; revert only this planning PR.
- Done: every required authorization, input, UUID, quota, persistence, notification, redaction, UI, and regression scenario is executable and traceable.

### P3 — Deliver the approved design

- [x] Deliver the existing approved design as a third planning-only PR after P2 merges. <!-- sdd-owner: implementation -->
- Objective: publish `openspec/changes/in-app-feedback/design.md` as the implementation boundary and slice plan.
- Dependencies: P2 merged; refresh from `origin/develop`; target `develop`.
- Allowed paths: `openspec/changes/in-app-feedback/design.md` only; no product, test, config, or planning-evidence edits.
- TDD/guard mutation: not applicable; no product guard is changed.
- Verification: no product RED/GREEN run; run `git diff --check` and verify the file map, exact SQL algorithm, lifecycle correction, and six-slice forecast.
- Forecast/rollback: approximately 356 design-artifact lines, hard cap 390; revert only this planning PR.
- Done: design decisions are preserved, including AuthGuard-success oracle, tenant guards, two models, notifier allowlist, BFF provenance, widget lifecycle, and `develop` chain rules.

### P4 — Deliver this task plan

- [x] Deliver `openspec/changes/in-app-feedback/tasks.md` as the fourth and final planning PR before source apply. <!-- sdd-owner: implementation -->
- Objective: make planning and behavior slices independently executable, reviewable, and revertible.
- Dependencies: P3 merged; refresh from `origin/develop`; target `develop`.
- Allowed paths: `openspec/changes/in-app-feedback/tasks.md` only; do not edit proposal, spec, design, source, tests, config, or planning evidence.
- TDD/guard mutation: not applicable; source guard falsifications are assigned below and are temporary, local, and never committed.
- Verification: run `git diff --check`; expected `tasks.md` stays under 340 lines and contains all hard-cap, ownership, command, mutation, rollback, and chain instructions.
- Forecast/rollback: this artifact ≤340 lines; hard cap 340; revert only the task-plan PR.
- Done: source apply starts only from a refreshed `develop` containing P1–P4.

## Behavior source chain

### S1 — Atomic tenant-pair quota foundation

- [x] Implement and verify atomic five-per-ten-minute tenant-pair reservation with PostgreSQL evidence. <!-- sdd-owner: implementation -->
- Objective: add `FeedbackType`, `FeedbackReport`, `FeedbackSubmissionAttempt`, visible migration/indexes, registry entries, repository token, and advisory-lock reservation; no HTTP exposure yet.
- Dependencies: P1–P4 merged; fresh worktree from refreshed `origin/develop`.
- Allowed paths: `apps/api/prisma/schema.prisma`; new `apps/api/prisma/migrations/<timestamp>_add_feedback/migration.sql`; `apps/api/src/database/tenant-isolation.extension.ts`; new `apps/api/src/feedback/feedback.repository.ts`, `prisma-feedback.repository.ts`, `feedback-rate-limit.guard.ts`; explicit focused guard unit spec `apps/api/src/feedback/__tests__/feedback-rate-limit.guard.spec.ts`; focused tests under `apps/api/src/feedback/__tests__/` and `apps/api/test/feedback-rate-limit.e2e-spec.ts`; `openspec/changes/in-app-feedback/apply-progress.md` evidence only.
- RED: add the guard allowed-versus-429 unit test, reservation, registry-parity, cutoff, pair-isolation, and six-concurrent tests first; run `TEST_DATABASE_URL=<viewpro_test-or-per-worker-url> DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @viewpro/api exec vitest run src/feedback/__tests__/feedback-rate-limit.guard.spec.ts src/feedback/__tests__/feedback-rate-limit.repository.spec.ts src/database/tenant-isolation.registry.spec.ts test/feedback-rate-limit.e2e-spec.ts`; expected missing models/registry/implementation and guard/concurrency assertions fail.
- GREEN: run `pnpm --filter @viewpro/api db:validate && pnpm db:generate && pnpm --filter @viewpro/api exec vitest run src/feedback/__tests__/feedback-rate-limit.guard.spec.ts src/feedback/__tests__/feedback-rate-limit.repository.spec.ts src/database/tenant-isolation.registry.spec.ts test/feedback-rate-limit.e2e-spec.ts`; TRIANGULATE the guard's allowed-versus-429 result separately from the repository's five allowed/sixth limited, exact cutoff, independent pairs, DB clock, and concurrent pool cases; REFACTOR only after `pnpm --filter @viewpro/api typecheck` and that focused command is green.
- Guard mutation: make `FeedbackRateLimitGuard` always allow or bypass `reserveAttempt`; run the focused `feedback-rate-limit.guard.spec.ts` allowed-versus-429 unit proof, which must fail. Do not claim this guard mutation falsifies the repository's real-PostgreSQL concurrent-six proof.
    - Repository mutation: remove the advisory lock or separate the count from the insert into independently committed operations; against real PostgreSQL run the six-concurrent repository test, and its exact-five-allowed/one-limited result with five rows must fail.
    - Registry mutations: remove `FeedbackReport` from `TENANT_OWNED_MODELS`, restore it, and run parity; then independently remove `FeedbackSubmissionAttempt`, restore it, and run parity. Each separate parity assertion must fail.
- Restoration/final green: restore each mutation and rerun the named focused suite plus `pnpm --filter @viewpro/api db:validate`; record RED, mutation failure, restoration, and green in `apply-progress.md`.
- Non-goals: no controller, auth change, notifier, UI, navigation, owner surface, or generic throttler use. Forecast 285–350 lines, hard cap 380 including migration/tests/evidence. Rollback removes only this quota foundation and migration before dependent slices.
- Done: spec requirements exact quota and durable tenant-owned models; scenarios first-five, sixth-429 foundation, pair isolation, rolling cutoff, and concurrency are proven.

### S2 — Authenticated durable submission boundary

- [x] Implement and verify authenticated tenant-member validation and durable report creation. <!-- sdd-owner: implementation -->
- Objective: add DTO, server-derived controller boundary, membership/rate-guard wiring, report repository create, use case, module/import, and API tests.
- Dependencies: S1 merged to `develop`; refresh the next worktree from refreshed `origin/develop`.
- Allowed paths: new `apps/api/src/feedback/dto/submit-feedback.dto.ts`, `feedback.controller.ts`, `feedback.module.ts`, `use-cases/submit-feedback.use-case.ts`; S1 feedback repository/guard files only as needed; `apps/api/src/app.module.ts`; focused `apps/api/src/feedback/__tests__/` and `apps/api/test/feedback.e2e-spec.ts`; `apply-progress.md` evidence.
- RED: write unauthenticated, normally-valid authenticated-success, non-member, spoof-field, enum/length/pathname/UUID, persistence-failure, and tenant-attribution tests; run `pnpm --filter @viewpro/api exec vitest run src/feedback/__tests__/submit-feedback.dto.spec.ts src/feedback/__tests__/feedback.controller.spec.ts test/feedback.e2e-spec.ts`; expected 404/unwired boundary or failing assertions.
- GREEN/TRIANGULATE/REFACTOR: run focused tests, `pnpm --filter @viewpro/api typecheck`, and `pnpm --filter @viewpro/api test`; triangulate both types, 9/10/2000/2001 lengths, inert plaintext, pathname 512/513/`?`/`#`, canonical UUIDv4, auth/membership no-write, server attribution, and persistence 500; refactor after all green.
- Guard mutations: remove `AuthGuard` from `FeedbackController`; the normally valid authenticated-success test must fail because the access token no longer populates `request.user`. Remove `TenantMembershipGuard`; non-member/no-write and server-tenant attribution tests must fail. Temporarily map body `userId`/`tenantId` into persistence; spoof attribution tests must fail. Remove pathname or canonical-v4 validation; corresponding boundary tests must fail.
- Restoration/final green: restore each mutation one at a time and rerun focused e2e/unit tests; record evidence. Do not rely on unauthenticated rejection alone as AuthGuard proof.
- Non-goals: no owner authorization, roles, middleware, nav/sidebar, notifier delivery, or client work. Forecast 325–375 lines, hard cap 395 including tests/evidence. Rollback reverts this API boundary while retaining S1 only if quota data must remain.
- Done: spec authorization, exact input contract, server attribution, optional fields, persistence-failure sanitization, and tenant-isolation scenarios pass.

### S3 — Durable-before-email notification and production configuration

- [x] Implement and verify the dedicated sanitized notifier and fail-safe environment selection. <!-- sdd-owner: implementation -->
- Objective: add approved-field text/escaped HTML template, narrow notifier port/adapters, production recipient validation, deterministic non-production no-op, and post-create notification handling.
- Dependencies: S2 merged; refresh from `origin/develop` and target `develop`.
- Allowed paths: new `apps/api/src/feedback/notification/feedback-notifier.port.ts`, `feedback-notifier.adapters.ts`, `feedback-email.template.ts` and their tests; `apps/api/src/feedback/use-cases/submit-feedback.use-case.ts`, `feedback.module.ts`; `apps/api/src/config/env.schema.ts`, `app.config.ts`, `.env.example`; config tests; `apply-progress.md` evidence.
- RED: add ordering, one-call provider failure, allowlist/escaping, hostile-log redaction, production missing/malformed/multiple recipient/key, and dev/test no-op tests; run `pnpm --filter @viewpro/api exec vitest run src/feedback/notification/__tests__/feedback-email.template.spec.ts src/feedback/notification/__tests__/feedback-notifier.spec.ts src/config/__tests__/env.schema.spec.ts src/config/__tests__/app.config.spec.ts`; expected missing adapter/config behavior.
- GREEN/TRIANGULATE/REFACTOR: run focused tests and `pnpm --filter @viewpro/api typecheck`; triangulate success/no-op/provider rejection, durable commit before exactly one send, approved content only, exact log keys `{reportId,timestamp,category,code}`, and all four diagnostic codes; refactor then run `pnpm --filter @viewpro/api test`.
- Guard mutations: call notifier before repository create or stop swallowing notifier rejection; ordering/provider tests must fail. Log the provider object or notification input; redaction tests must fail. Permit production no-op or multiple-recipient parsing; production config tests must fail.
- Restoration/final green: restore each mutation and rerun focused suites, then verify accepted `201` with one persisted report and no duplicate on provider failure.
- Non-goals: no edits to shared `EmailSender`, invitation templates, health controller, Sentry, inbox, or routing. Forecast 300–365 lines, hard cap 385 including config/tests/evidence. Rollback removes notifier wiring/config additions while preserving accepted report tables.
- Done: spec notification fields, exact recipient, production fail-fast, no-op distinction, durable-before-email, failure acceptance, and sanitized observability scenarios pass.

### S4 — Provenance-preserving BFF submission

- [x] Implement and verify pathname derivation and browser-only canonical request-ID propagation. <!-- sdd-owner: implementation -->
- Objective: add the BFF route and typed feedback service; forward only canonical backend IDs; keep private latest-ID memory SSR-safe and clear-only.
- Dependencies: S3 merged; refresh from `origin/develop`.
- Allowed paths: new `apps/app-new/src/app/api/feedback/route.ts` and test; `apps/app-new/src/lib/bff-api.ts` and test; `apps/app-new/src/lib/bff-client.ts` and existing BFF tests; new `apps/app-new/src/features/feedback/api/types.ts`, `service.ts`, `service.test.ts`; `apply-progress.md` evidence.
- RED: add header allowlist, body/header capture, SSR-empty, invalid-ID, pathname, and no-public-setter/service-argument tests; run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/bff-api.test.ts src/lib/__tests__/bff-client.spec.ts src/features/feedback/api/service.test.ts`; expected absent route/provenance behavior.
- GREEN: run the focused command and `pnpm --filter next-shadcn-dashboard-starter lint:strict`; TRIANGULATE canonical lowercase v4 header preference, body fallback, invalid/uppercase/non-v4 ignore, browser-only capture, pathname-only request, and BFF status/body proxy; REFACTOR then run `pnpm --filter next-shadcn-dashboard-starter test`.
- Guard mutations: copy arbitrary `x-request-id` without canonical-v4 filtering; header allowlist tests must fail. Add/export a value-taking public setter, allow a request-ID service/form argument, or permit SSR capture; export-surface/provenance tests must fail.
- Restoration/final green: restore each mutation and rerun focused tests; prove only `bffRequest` captures prior response IDs and no ledger, storage, URL, or form source exists.
- Non-goals: no API identity, UUID issuance ledger, auth/middleware, nav, or widget mount edits. Forecast 285–345 lines, hard cap 375 including tests/evidence. Rollback removes BFF feedback route/service and provenance additions without changing backend behavior.
- Done: spec pathname, prior-response provenance, canonical UUIDv4 shape, SSR isolation, and public-error transport scenarios pass.

### S5 — Authenticated floating feedback flow

- [x] Implement and verify the complete floating widget with safe success, retry, rate-limit, and accessibility states. <!-- sdd-owner: implementation -->
- Objective: add client-only `FeedbackWidget`, mount it as a dashboard-layout sibling, preserve retry content, use registry icons, and branch only on status/errorCode.
- Dependencies: S4 merged; refresh from `origin/develop`.
- Allowed paths: new `apps/app-new/src/features/feedback/components/feedback-widget.tsx` and test; `apps/app-new/src/app/dashboard/layout.tsx` and optional focused layout test; no icon-file edit; `apply-progress.md` evidence.
- RED: add trigger/form, exact choices, bounds/count, duplicate-submit, pathname service, success, retry, 429, close/reopen, focus/ARIA, mobile placement, and same-status/different-message tests; run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/feedback/components/feedback-widget.test.tsx`; expected missing widget/mount behavior.
- GREEN: run the focused command and `pnpm --filter next-shadcn-dashboard-starter lint:strict`; TRIANGULATE 201 durable success, notifier-failure-as-success, 401/session, generic failure, 429 guidance, preserved content, explicit discard reset, disabled submitting controls, and all `Icons` usage; REFACTOR then run `pnpm --filter next-shadcn-dashboard-starter test`.
- Guard mutations: omit mount clearing or unmount cleanup one at a time; capture-unmount-remount tests must fail. Branch on `error.message`; equal status/errorCode with different messages must fail. Add a request-ID input/service argument; UI/service provenance tests must fail.
- Restoration/final green: restore every mutation and rerun focused tests; prove mount clears before reuse and cleanup clears after unmount, while current-mount captures remain available.
- Non-goals: no `AppSidebar`, header, nav config, proxy, middleware, roles, owner portal, auth, or Sentry edits. Forecast 315–375 lines, hard cap 395 including tests/evidence. Rollback removes the widget/layout mount only; retain backend reports and migration.
- Done: spec floating entry, bounded form, icons registry, durable-success semantics, status/errorCode-only branching, retry preservation, rate-limit guidance, and accessibility/mobile scenarios pass.

## Final cross-slice verification phase (not an implementation PR)

### V1 — Full contract and regression verification

- [x] Run the final cross-slice verification phase and record evidence without creating a test-only source PR. <!-- sdd-owner: implementation -->
- Objective: verify the integrated chain, all mutation evidence, baseline preservation, and rollout safety after S1–S5 merge.
- Dependencies: S1–S5 merged sequentially into refreshed `develop`; use a clearly marked PostgreSQL test/per-worker database.
- Allowed paths: `openspec/changes/in-app-feedback/apply-progress.md` and `openspec/changes/in-app-feedback/verify-report.md` evidence only; any code hardening returns to its owning S1–S5 unit.
- RED/GREEN/TRIANGULATE/REFACTOR: no new product RED; first rerun the recorded focused premise-baseline commands that observed 48 API and 29 frontend tests and require both subsets to remain green. Those 48 and 29 counts are focused baseline subsets, not complete package-suite totals. Then rerun `pnpm db:generate`, `pnpm --filter @viewpro/api db:validate`, `pnpm --filter @viewpro/api typecheck`, `pnpm --filter @viewpro/api test`, `pnpm --filter next-shadcn-dashboard-starter test`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, and `pnpm --filter next-shadcn-dashboard-starter test:seeded`; require all current full-suite API/frontend tests, including the new feedback tests, to pass without describing either full suite as containing only 48 or 29 tests. Any failure is assigned to its owning behavior unit.
- Guard mutations: introduce no new mutation; confirm apply evidence covers all exact S1–S5 falsifications (#1–#11), with missing or inadequate evidence returned to the owning unit rather than a test-only PR.
- Restoration/final proof: record commands, database safety, migration/generated-client status, all focused suites, full suites, skipped checks, residual risks, and clean `git diff --check`.
- Non-goals/forecast/rollback: no source edits, no migration reversal, no commit/push/PR; 80–140 evidence lines, hard cap 180; revert evidence only if necessary.
- Done: every spec requirement and scenario has evidence, no forbidden surface changed, production configuration/readiness is documented, and rollback preserves accepted reports.

## Parent-owned post-apply lifecycle gates

- [x] Start or reuse the bounded RDD review only after apply, using native `status --next-transition`; intentionally skipped because RDD was explicitly disabled and delivery is ordinary/unmanaged. <!-- sdd-owner: parent -->
- [x] After each accepted unit, refresh `origin/develop`, create the next worktree/branch from it, and handle the ordinary commit/PR lifecycle outside SDD apply; every PR targets `develop`. <!-- sdd-owner: parent -->

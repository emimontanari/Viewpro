# Verification Report: Seller Property Proposals

**Final disposition:** PASS with residuals
**Verified target:** `origin/develop` @ `6b7819be`
**Issue:** #306

## Provenance

- Delivery PRs: #624 U22A API e2e (`a57cb42d`), #625 StrictMode unmount query purge fix (`a2798ab5`), #626 detail submit after save fix (`c471b671`), and #627 U22B seeded journeys (`6b7819be`). Earlier units are recorded in `apply-progress.md`.
- CI run **37053929774** on develop @ `6b7819be`: Build/Typecheck/Lint, Test, Seeded E2E, Production cutover contracts, and Dependency audit all succeeded. Test: 36/36 matrix test files passed (API unit/repository/e2e, app-new vitest, contracts); Seeded E2E: `apps/app-new/tests/seeded/property-proposals.spec.ts` 3/3 (38 passed total).
- Review gate: per-unit independent gates are recorded in `apply-progress.md` (including C7A1, C8A, and U21A CHANGES_REQUIRED then corrected). A focused final read-only frontend review on 2026-10-02 used reliability and risk/security lenses. The /new create-then-submit MAJOR claim was rejected: `new/page.tsx` renders the form without a key and has no navigation or proposal-query subscription, hence no remount path. Risk/security review PASS: tenant-scoped query keys, encoded path params, generic BFF errors, no unsafe HTML/open redirects; backend authorization is covered by S02/S12/S13. Zero blockers.

## Requirement and scenario results

All 49 evidence-matrix rows are COVERED. RED test paths below are taken from `task-evidence-matrix.md`. All 37 distinct matrix test files exist and passed in the cited CI run: 36 in Test and the seeded property-proposals spec 3/3.

| ID | Capability | RED test file(s) | Status |
| --- | --- | --- | --- |
| S01 | Proposals | apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.spec.ts | COVERED |
| S02 | Proposals | apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts | COVERED |
| S03 | Proposals | apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.spec.ts | COVERED |
| S04 | Proposals | apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts | COVERED |
| S05 | Proposals | apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.spec.ts | COVERED |
| S06 | Proposals | apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts | COVERED |
| S07 | Proposals | apps/api/src/property-proposals/property-proposals.controller.spec.ts | COVERED |
| S08 | Proposals | apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.spec.ts | COVERED |
| S09 | Proposals | apps/api/src/property-proposals/use-cases/submit-property-proposal.replay.spec.ts | COVERED |
| S10 | Proposals | apps/api/src/property-proposals/use-cases/submit-property-proposal.replay.spec.ts | COVERED |
| S11 | Proposals | apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts | COVERED |
| S12 | Proposals | apps/api/test/property-proposals.e2e-spec.ts | COVERED |
| S13 | Proposals | apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts | COVERED |
| S14 | Proposals | apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts | COVERED |
| S15 | Proposals | apps/api/src/property-proposals/review-filter-builder.spec.ts | COVERED |
| S16 | Proposals | apps/api/src/property-proposals/dto/list-property-proposal-review.query.spec.ts | COVERED |
| S17 | Proposals | apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts | COVERED |
| S18 | Proposals | apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts | COVERED |
| S19 | Proposals | apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts | COVERED |
| S20 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S21 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S22 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S23 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S24 | Proposals | apps/api/src/property-engagements/active-property-engagement-capacity.spec.ts | COVERED |
| S25 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts | COVERED |
| S26 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts | COVERED |
| S27 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S28 | Proposals | apps/api/src/property-proposals/property-proposals.controller.spec.ts | COVERED |
| S29 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts | COVERED |
| S30 | Proposals | apps/api/src/property-proposals/use-cases/approve-property-proposal.replay.spec.ts | COVERED |
| S31 | Proposals | apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts | COVERED |
| S32 | Proposals | apps/api/src/property-proposals/use-cases/review-transition-conflict.spec.ts | COVERED |
| S33 | Proposals | apps/api/test/property-proposal-approval-race.spec.ts | COVERED |
| S34 | Proposals | apps/api/src/permissions/property-proposals-role-permissions.spec.ts | COVERED |
| S35 | Proposals | apps/api/test/property-engagements.e2e-spec.ts | COVERED |
| S36 | Proposals | apps/app-new/src/features/property-proposals/components/property-proposal-status-label.test.tsx | COVERED |
| S37 | Proposals | apps/api/src/property-proposals/responses/property-proposal.response.spec.ts | COVERED |
| S38 | Proposals | apps/api/src/property-proposals/responses/property-proposal.response.spec.ts | COVERED |
| S39 | Proposals | apps/api/test/property-proposal-migration-hardening.spec.ts | COVERED |
| S40 | Property primary seller | apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts | COVERED |
| S41 | Property primary seller | apps/api/test/property-agent-primary-concurrency.e2e-spec.ts | COVERED |
| S42 | Property primary seller | apps/api/test/property-agent-primary-concurrency.e2e-spec.ts | COVERED |
| S43 | Safe public error boundary | packages/contracts/test/runtime-contract.spec.ts | COVERED |
| S44 | Safe public error boundary | packages/contracts/test/runtime-contract.spec.ts | COVERED |
| S45 | Safe public error boundary | packages/contracts/test/runtime-contract.spec.ts | COVERED |
| S46 | Seller navigation scope | apps/app-new/src/config/nav-config.test.ts; apps/app-new/src/components/layout/app-sidebar.test.tsx; apps/app-new/src/components/kbar/palette.test.ts | COVERED |
| S47 | Seller navigation scope | apps/app-new/src/lib/navigation-access.test.ts | COVERED |
| S48 | Seller navigation scope | apps/app-new/src/config/nav-config.test.ts; apps/app-new/src/components/layout/app-sidebar.test.tsx; apps/app-new/src/components/kbar/palette.test.ts | COVERED |
| S49 | Seller navigation scope | apps/app-new/src/hooks/use-nav.test.ts | COVERED |

## Residuals

- No browser journey covers /new create-then-submit; the seeded spec creates proposals through the API. Follow-up.
- After a tenant switch unmounts proposal components through loading, prior-tenant proposal queries remain in memory until GC. Keys are tenant-scoped and are never shown under another tenant; documented in #625.
- S38 integration coverage exercises assignment-removal omission only; the full omission matrix is covered at unit level by `property-proposal.response.spec.ts`.

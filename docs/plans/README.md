# ViewPro Plans Source of Truth

This index prevents roadmap drift during final MVP execution.

## Canonical for current execution

Read these first, in order:

| Priority | Document                                                         | Purpose                                                                                           |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1        | `docs/plans/CURRENT_MVP_EXECUTION.md`                            | Current handoff for mutable completed/current/next MVP status and the validation gate.             |
| 2        | `docs/plans/2026-06-14-mvp-execution-plan-revision.md`           | **Active execution plan.** Adopts Stage 26.0 audit sub-slices and surfaces the open product decisions. |
| 3        | `docs/plans/2026-06-04-final-mvp-execution-plan.md`              | Canonical anchor for MVP gates, non-goals, PR slicing, and slice template. Historical, never rewritten. |
| 4        | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`         | Evidence overlay and origin of the adopted sub-slices.                                            |
| 5        | `docs/plans/2026-06-04-mvp-closure-slices.md`                    | Audited status for Stages 20–26 and corrected gap summary.                                        |
| 6        | `docs/plans/2026-05-28-mvp-product-final-like-roadmap-design.md` | Original product-final-like roadmap. Use when validating intent, not execution order.             |

## Current execution rule

Start with `docs/plans/CURRENT_MVP_EXECUTION.md`. It owns the current completed/current/next status ledger, source precedence, and the validation gate before any product work resumes.

Every new task must still declare:

```txt
Stage:
Slice:
Objective:
Evidence needed:
Do not touch:
Done:
Next slice:
```

If a request does not map to the current handoff and final MVP execution plan, treat it as backlog unless the user explicitly reprioritizes it. Future product/source changes must use SDD/OpenSpec before code changes.

## Historical planning docs

The older dated docs under `docs/plans/` are historical planning and implementation records. They are useful for context and evidence, but they do **not** override the canonical execution plan.

Use them to answer questions such as:

- why a feature exists;
- what was previously considered in/out of scope;
- which files were touched during an old slice;
- what evidence or acceptance criteria existed for a past change.

Do not use them to restart the roadmap or re-open completed refactors without a failing functional test.

## Current app-new docs

These app-new docs are the active app-new references for auth, navigation, and feature work:

- `viewpro-app/apps/app-new/docs/auth.md`
- `viewpro-app/apps/app-new/docs/nav-rbac.md`
- older `apps/web` frontend planning docs remain historical because they predate app-new as the active surface

Security, routing, permissions, and owner/dashboard separation must be verified from current code, tests, active app-new docs, and the canonical final MVP plan.

## Completed work not to reopen by default

Do not reopen these unless a functional regression is proven:

- S3/R2 document storage adapter and production storage wiring.
- Owner/document/product UI/UX refactors merged through the UI stack.
- ProductForm decomposition/refactor docs from 2026-05-29 and 2026-05-30.
- Stage 24 temporary implementation plans; unique notification architecture decisions were promoted into the final execution plan.

## Backlog and explicit exclusions

The final execution plan intentionally excludes:

- billing/Stripe/external billing providers;
- WhatsApp Business API;
- realtime notifications;
- AI/chat/marketplace;
- buyers/renters as users;
- native mobile app;
- advanced BI/reporting;
- Platform Owner impersonation;
- admin access to private tenant document content;
- UI polish without a failing functional/evidence gate.

## Active execution handoff

The current execution handoff is `docs/plans/CURRENT_MVP_EXECUTION.md`. Read it for the status ledger, quick-validation gate, and implementation-slice selection. This README is an index, not the mutable status ledger.

## Control-plane record

- `openspec/changes/consolidate-mvp-master-plan/` records the docs/control-plane consolidation that created the shared handoff and agent pointers.
- `openspec/changes/mvp-plan-reorder/` records the 2026-06-14 reorder that adopted the Stage 26.0 audit sub-slices into the active execution order without rewriting the canonical plan or the audit.
- Adopted sub-slice stubs live under `openspec/changes/22-8-seller-permission-hotfix/`, `20-10-state-authority-decision/`, `20-11-seguimiento-filter-corrections/`, `20-12-document-duplicate-guard/`, `23-5-owner-contact-cta-semantics/`, `21-7-transactional-invitation-email/`, `26-5a-inmoview-domain-handoff/`, and `26-6a-inmoview-copy-pass/`. Each carries an explicit `Status:` line and references the open product decision it depends on.
- Completed/current/next MVP status belongs in `docs/plans/CURRENT_MVP_EXECUTION.md`, not in this README.

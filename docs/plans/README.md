# ViewPro Plans Source of Truth

This index prevents roadmap drift during final MVP execution.

## Canonical for current execution

Read these first, in order:

| Priority | Document | Purpose |
| --- | --- | --- |
| 1 | `docs/plans/2026-06-04-final-mvp-execution-plan.md` | Current execution plan, priority gates, phases, PR slicing, and scope exclusions. |
| 2 | `docs/plans/2026-06-04-mvp-closure-slices.md` | Audited status for Stages 20–26 and corrected gap summary. |
| 3 | `docs/plans/2026-05-28-mvp-product-final-like-roadmap-design.md` | Original product-final-like roadmap. Use when validating intent, not execution order. |

## Current execution rule

Every new task must declare:

```txt
Stage:
Slice:
Objective:
Evidence needed:
Do not touch:
Done:
Next slice:
```

If a request does not map to the current final MVP execution plan, treat it as backlog unless the user explicitly reprioritizes it.

## Historical planning docs

The older dated docs under `docs/plans/` are historical planning and implementation records. They are useful for context and evidence, but they do **not** override the canonical execution plan.

Use them to answer questions such as:

- why a feature exists;
- what was previously considered in/out of scope;
- which files were touched during an old slice;
- what evidence or acceptance criteria existed for a past change.

Do not use them to restart the roadmap or re-open completed refactors without a failing functional test.

## Historical app-new docs

These app-new docs are starter/template context and are **not** security or product source of truth for the final MVP:

- `viewpro-app/apps/app-new/docs/clerk_setup.md`
- `viewpro-app/apps/app-new/docs/nav-rbac.md`
- older `apps/web` frontend planning docs that predate app-new as the active surface

Security, routing, permissions, and owner/dashboard separation must be verified from current code, tests, and the canonical final MVP plan.

## Completed work not to reopen by default

Do not reopen these unless a functional regression is proven:

- S3/R2 document storage adapter and production storage wiring.
- Owner/document/product UI/UX refactors merged through the UI stack.
- ProductForm decomposition/refactor docs from 2026-05-29 and 2026-05-30.
- Stage 24 temporary implementation plans; unique notification architecture decisions were promoted into the final execution plan.

## Backlog and explicit exclusions

The final execution plan intentionally excludes:

- billing/Stripe/Clerk Billing;
- WhatsApp Business API;
- realtime notifications;
- AI/chat/marketplace;
- buyers/renters as users;
- native mobile app;
- advanced BI/reporting;
- Platform Owner impersonation;
- admin access to private tenant document content;
- UI polish without a failing functional/evidence gate.

## Next active slice

```txt
Stage: 21
Slice: 21.6 — Minimal owner invitation management
Objective: give managers a clear way to regenerate/resend-copy and revoke pending owner invite links.
Evidence needed: API/UI tests for regenerate and revoke; accepted/expired/revoked states remain safe.
Do not touch: email delivery automation or advanced invitation analytics.
Done: manager can regenerate/copy a fresh pending link and revoke a pending link without DB/support help.
Next slice: 25.1 — Admin tenant status write API + audit log.
```

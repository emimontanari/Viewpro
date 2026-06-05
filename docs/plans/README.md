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

## Next active slice

```txt
Stage: 25
Slice: 25.4 — Tenant limits enforcement
Objective: enforce configured pilot limits for users/team, active property engagements, and documents/storage at mutation boundaries.
Evidence needed: API tests for allowed/blocked mutations, admin limit configuration checks, safe default behavior, and no regression to existing tenant workflows.
Do not touch: billing, paid plans, Stripe, or external billing providers.
Done: tenant limits are enforced consistently with clear errors and existing allowed flows still pass.
Next slice: 26.0 — MVP evidence audit.
```

## Recently completed

- Stage 25.3 — Tenant limits model and API: tenant limit schema/migration, admin read/write API, safe defaults, and global admin authorization evidence completed.
- Stage 25.2 — Admin tenant management UI: app-new `/admin` surface, admin BFF routes without `x-tenant-id`, tenant status badges/actions, confirmation dialog, Spanish loading/error/success states, and pnpm UI/service evidence completed.
- Stage 25.1 — Admin tenant status write API + audit log: backend admin status endpoint, atomic `TENANT_STATUS_CHANGED` audit, global admin authorization, tenant guard proof, and concurrent duplicate-write protection completed with API evidence.
- Stage 21.6 — Minimal owner invitation management: backend revoke endpoint, app-new BFF/service, and property owner UI actions for `Regenerar y copiar link` and `Revocar invitación` completed with API/UI evidence.

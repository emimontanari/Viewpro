# Proposal — Stage 26.2 Deterministic Seed Contract

## Intent

Make `pnpm demo:seed` produce a safe, repeatable demo/pilot dataset that can be used as the canonical proof base for Stage 26.3 full seeded E2E.

## Slice contract

```txt
Stage: 26
Slice: 26.2 — Deterministic seed contract
Objective: keep a stable demo/pilot dataset that exercises real business flows.
Evidence needed: seed run logs and smoke proof for manager, seller, owner, properties, images, movements, documents, notifications.
Do not touch: production data behavior.
Done: seed is deterministic, safe, and covers the full product story.
Next slice: 26.3.
```

## Problem

The current demo seed already creates the main tenant, manager/seller/owner users, properties, movements, document requests, owner upload/review states, and existing-owner invitation proof. However Stage 26.0 evidence shows the seed is not yet a durable contract for pilot proof:

- no explicit seed manifest/log contract defines expected fixture accounts, counts, states, or proof points;
- no `VIEWPRO_ADMIN` fixture exists for admin browser proof;
- tenant status/limit data is not asserted as part of the seed contract;
- notifications are not deterministically seeded for read/unread, safe links, and owner/internal surfaces;
- contact data does not yet prove tenant/Cuenta Madre priority, seller contact, and no-config states;
- property image count depends on remote image downloads and can vary silently;
- the seeded smoke proves useful manager/seller/owner/document paths, but not the minimal Stage 26.2 proof set needed before the full Stage 26.3 choreography.

## Scope

- Add an explicit demo seed contract manifest and summary logs for stable fixture keys, expected counts, seeded accounts, tenant slug/status/limits, contact fixtures, notification fixtures, image strategy, and smoke-proof anchors.
- Keep `viewpro-app/apps/api/scripts/seed-demo.mjs` idempotent and restricted to the demo tenant/users; preserve the existing production and unsafe-DB guards.
- Add a safe global admin fixture using the existing `GlobalRole.VIEWPRO_ADMIN` role, plus deterministic tenant status/limit data for admin proof.
- Add deterministic notification fixtures covering owner/internal surfaces, read and unread states, supported notification types, safe relative links, and references to seeded properties/documents/movements.
- Add deterministic contact fixtures for tenant WhatsApp, seller WhatsApp, and at least one seller/no-config scenario so contact priority can be proven without DB edits.
- Make smoke-critical property images deterministic enough for tests, preferably by using local/generated fixture bytes instead of live external image dependencies.
- Extend the seeded smoke minimally to prove the Stage 26.2 contract: seed counts/logs, manager/seller/owner access, images, movements, documents, notifications read/unread/safe links, admin fixture/status/limits, and contact priority/no-config behavior.

## Out of scope

- Production data behavior, migrations for new product concepts, billing, Stripe, paid plans, external email delivery, WhatsApp Business API, bots, realtime notifications, broad UI redesign, or full Stage 26.3 manager → seller → owner → admin choreography.
- Changing role/permission semantics beyond creating seed data that uses existing roles and guards.
- Reopening completed Stage 26.1 route cleanup unless the Stage 26.2 smoke exposes a regression.

## Affected areas

- `viewpro-app/apps/api/scripts/seed-demo.mjs` and any small seed fixture helpers/assets needed for deterministic local image/document data.
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` or adjacent seeded smoke coverage.
- Seed/demo documentation or generated manifest location if needed to make the contract visible.
- OpenSpec artifacts for this change.

## Safety and security constraints

- The seed MUST continue to refuse `NODE_ENV=production` and missing/unsafe `DATABASE_URL` unless `VIEWPRO_ALLOW_DEMO_SEED=true` is deliberately set.
- The seed MUST only reset the canonical demo tenant/users/fixture data it owns and must not delete arbitrary tenants or production-like data.
- Manifest/log output MUST avoid leaking non-default secrets; fixture accounts may be listed, but env-provided passwords should be redacted or described safely.
- Notification links MUST be safe relative links for their surface: owner notifications stay under `/owner...`; internal notifications stay on dashboard-safe routes.

## Risks

- Expanding the seed can accidentally delete or mutate non-demo data if ownership filters are too broad.
- Remote image downloads can make seed counts flaky unless replaced or made contract-failing rather than silently skipped.
- A global admin fixture could blur tenant membership assumptions if it is also attached to the demo tenant without a clear reason.
- Over-extending the smoke in this slice could duplicate Stage 26.3 and exceed the intended small proof boundary.

## Rollback

Revert the Stage 26.2 seed/test/docs changes and remove this OpenSpec change folder. For local/dev databases, rerun the prior seed or reset the local database to remove any newly added demo fixtures. No production data or production runtime behavior should require rollback.

## Success criteria

- `pnpm demo:seed` succeeds idempotently against a safe local/dev/test database and emits stable contract evidence for tenant, users, admin, properties, images, movements, documents, notifications, contact fixtures, and limits/status.
- Re-running the seed produces the same semantic fixture set and counts without duplicate demo rows.
- Seeded smoke proves the minimal Stage 26.2 contract, including manager, seller, owner, admin, property images, movement/activity, document states, notification read/unread plus safe links, and contact priority/no-config behavior.
- Production-safety guards remain covered by code review and, where practical, focused tests or smoke checks.
- Full workflow creation/choreography remains queued for Stage 26.3 after the deterministic seed contract is accepted.

# Issue #456 — ZonaProp property import

Tracker branch: `feat/456-zonaprop-import`, base `origin/develop` @ f0e8358f.
Approved issue: #456 (`status:approved`). OpenSpec `openspec/changes/zonaprop-property-import/` accepted 2026-10-04.
Delivery: `feature-branch-chain` (user-selected) — draft tracker PR to `develop`, one child PR per work unit, each ≤400 authored lines.

## Tasks

- [x] Map discovery doc, data model, async infrastructure, storage, control lane and frontend entry points.
- [x] Decide publisher verification without manual 24/7 review.
- [x] Draft OpenSpec exploration, proposal, design, delta specs and tasks with a work-unit delivery plan.
- [x] Obtain user acceptance of the design and slicing before implementation.
- [x] U1a — External property references and publisher claims (schema, migration, isolation, constraint tests). Commit `24666221`, PR #635.
- [ ] U1b — Import batch, candidate and durable work records (schema, migration, isolation, constraint tests).
- [ ] U2 — URL/publisher parsing, mapping, Córdoba/CABA fixtures and contract tests.
- [ ] U3 — Fixture-fed staging and idempotent confirmation.
- [ ] U4 — Publisher verification ladder.
- [ ] U5 — Apify runs, webhook and durable work rows.
- [ ] U6 — R2 image pipeline.
- [ ] U7 — Review/confirm UI and #459 handoff.
- [ ] U8 — Opt-in bounded smoke and operational closeout.

## Decisions

- Publisher verification is an automatic proof-of-control ladder:
  1. Verified principal-manager email domain matches the non-generic `agencyEmail` domain published by ZonaProp → approved.
  2. Otherwise, a one-time code is sent through Resend to the exact `agencyEmail` published by ZonaProp; entering it approves.
  3. Fallback: a short code placed in one of the publisher's listing descriptions, verified by a bounded scrape.
  Name and phone are displayed signals only. An already-approved claim by another tenant blocks the import with a contact-support message; no live manual review.
- Durable work (accepted): database-backed work rows processed in-process when triggered by the webhook, confirmation or an explicit user retry, and resumed on API startup. No polling or timers. `apps/api` runs as a long-lived Dokploy container.

## Constraints

Preserve tenant isolation, capacity limits, authorization and audit. No owners import (#459). No network calls in normal tests; fixtures only. Apify account and secrets are needed only for the bounded operational smoke test. Each work unit ≤400 authored lines with tests alongside.

- Accepted limits: 8-digit codes; email code TTL 15 min, listing code TTL 24 h; 5 attempts; resend cooldown 60 s; max 3 sends/hour; HMAC-hashed codes. Images: 10/property, 10 MiB/image, 50 MiB/property, 3 redirects. Raw payload retention 30 days.

## Evidence

Read-only exploration: muua3oy1-k-pvj2. Discovery doc: `docs/zonaprop-import-discovery.md`.
Planning: commit `b0cb4c6a`, RDD `review-cc2a2b1337c87835` (advisory: no-timer lease recovery → handle in U5). Tracker PR #634.
U1a: commit `24666221`, 263+/5−; RED `42P01`; focused 38 tests + full API suite 1,804 tests green; RDD `review-56ee2322e5d11590` (advisory: reference tenant not forced equal to engagement tenant at DB level → U3 writes both in one tenant-scoped transaction and tests it). Original 526-line U1 split honestly into U1a/U1b; full draft kept in local-only `wip/456-u1-full`.
Local test DBs: use `127.0.0.1` (localhost resolves to IPv6 and Colima does not answer). Isolated bases `viewpro_456_import`, `viewpro_456_test`.

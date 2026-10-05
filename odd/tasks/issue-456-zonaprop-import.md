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
- [x] U1b — Import batch, candidate and durable work records (schema, migration, isolation, constraint tests). Commit `dd80d712`, PR #636.
- [x] U2a — Shape-independent parsing and normalization: advertiser/listing URLs, city/province split, type table, price/currency pair, feature codes, phone/domain normalization. Commits `53d385bd` + `6b865a83`, PR #637.
- [ ] U2b — Raw payload adapter with captured Córdoba/CABA fixtures and drift contract tests (blocked until the user creates an Apify account).
- [x] U3a — Fixture-fed staging: batch creation, candidate ingestion from normalized input, states, edit/exclude, listing. Commits `c1c95beb` + `6c262e53`.
- [x] U3b — Idempotent confirmation: materialization through the canonical create/capacity path, external references, tenant equality, permission revalidation, partial retry, concurrency. Commits `67cca04e` + `825d94ea`.
- [ ] U4 — Publisher verification ladder (in progress; U4a is only the pure policy slice).
- [ ] U4a — Corrected pure domain signal implementation pending native review/publication on `feat/456-u4a-domain-policy`: normalized exact domain equality is context only; proof is required for all results, including matching public domains. No denylist, provenance acquisition, claim persistence/approval, or challenge flows. **No behavior RED was captured** (the initial failure was the renamed API export being absent); focused suite 16/16, full API suite 185 files / 1,870 tests, tsc, lint, and diff check passed. Commit `24cca3b5` recorded the superseded denylist/eligibility draft; this correction removes that behavior without rewriting history. **U4a review/publication pending; U4 remains incomplete.**
- [ ] U5 — Apify runs, webhook and durable work rows.
- [ ] U6 — R2 image pipeline.
- [ ] U7 — Review/confirm UI and #459 handoff.
- [ ] U8 — Opt-in bounded smoke and operational closeout.

## Decisions

- Publisher domain equality is context signal only and never proof or approval. Every claim requires a one-time code to the exact trusted provider-published agency address; fallback is a short code placed in a publisher listing description, verified by a bounded scrape. Name and phone are displayed signals only, not proof. An already-approved claim by another tenant blocks the import with a contact-support message; no manual operator review or new provider/identity integration.
- Durable work (accepted): database-backed work rows processed in-process when triggered by the webhook, confirmation or an explicit user retry, and resumed on API startup. No polling or timers. `apps/api` runs as a long-lived Dokploy container.

## Constraints

Preserve tenant isolation, capacity limits, authorization and audit. No owners import (#459). No network calls in normal tests; fixtures only. Apify account and secrets are needed only for the bounded operational smoke test. Each work unit ≤400 authored lines with tests alongside.

- Accepted limits: 8-digit codes; email code TTL 15 min, listing code TTL 24 h; 5 attempts; resend cooldown 60 s; max 3 sends/hour; HMAC-hashed codes. Images: 10/property, 10 MiB/image, 50 MiB/property, 3 redirects. Raw payload retention 30 days.

## U4a scope boundary

Trusted provider-published agency email, server-side identity/membership retrieval, atomic approved-claim conflict handling, email sender/challenge persistence, and listing-description proof are separate future U4 children. The pure domain signal cannot establish input provenance or approve a claim. U4 is not complete after U4a.

## Evidence

Read-only exploration: muua3oy1-k-pvj2. Discovery doc: `docs/zonaprop-import-discovery.md`.
Planning: commit `b0cb4c6a`, RDD `review-cc2a2b1337c87835` (advisory: no-timer lease recovery → handle in U5). Tracker PR #634.
U1a: commit `24666221`, 263+/5−; RED `42P01`; focused 38 tests + full API suite 1,804 tests green; RDD `review-56ee2322e5d11590` (advisory: reference tenant not forced equal to engagement tenant at DB level → U3 writes both in one tenant-scoped transaction and tests it). Original 526-line U1 split honestly into U1a/U1b; full draft kept in local-only `wip/456-u1-full`.
U1b: commit `dd80d712`, 370+/6−; RED missing models + inventory 31≠34; focused 41 tests + full API suite 1,807 tests green; RDD `review-4582554598da114f` (advisory: candidate/batch/reference tenant equality not DB-enforced → same U3 follow-up).
U2 split: the discovery doc does not fix raw field paths for price/currency, operation, title, garages or agency email, and no captured payloads exist in the repo. Inventing paths was rejected; U2a covers shape-independent logic now, U2b waits for captured payloads. User will create the Apify account later; U5 and U8 also depend on it.
U2a: 226+/2−, 27 tests; RDD `review-13f531e8dc9d0c1d` flagged inherited feature codes, fractional areas and zero-cent prices → fixed test-first in `6b865a83`, RDD `review-dbaa57bbacd33826` clean.
U3 pre-split into U3a/U3b: staging and confirmation together would exceed 400 lines.
U3a: parent review of the first draft found re-staging could reset CONFIRMED/IMPORTED rows (double-import risk), READY rows unselected, a wrong Córdoba fixture and inverted architecture → reworked to mirror property-proposals. RDD `review-d599a0c331d05dd8` then flagged stale features on re-stage and a read-then-write state race; fixing exposed missing `ageYears`/`orientation` candidate columns (would crash real payloads) and Int area columns vs decimal areas. Fixed test-first in `6c262e53` with an additive migration (Prisma's generated SQL included unrelated develop drift — trimmed to the two columns); RDD `review-cb5f0cc031e7cf54` approved. Full API suite 183 files / 1,845 tests green.
U3b: one transaction per row (READY→CONFIRMED guard, existing-reference check, shared `ActivePropertyEngagementCapacity`, asset + engagement + reference, IMPORTED); permission (`engagements.create`) and tenant-owned APPROVED claim revalidated at confirm time. Parent review fixed misreported/dropped outcomes for rows taken by a sibling confirmation (`skipped`), unguarded post-rollback writes (now state-guarded) and raw driver messages in `errorReason` (now `import_failed` + server log). RDD `review-7290da136140eddd` flagged known listings reported as capacity-exceeded at a full plan → fixed test-first in `825d94ea`, RDD `review-1a648f63d60fffd7` clean. Advisory deferred to U5: the concurrency test may not force true interleaving; database guards (conditional transition + unique reference) carry the guarantee. Full API suite 184 files / 1,854 tests.
Local test DBs: use `127.0.0.1` (localhost resolves to IPv6 and Colima does not answer). Isolated bases `viewpro_456_import`, `viewpro_456_test`.

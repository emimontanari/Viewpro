# Tasks: ZonaProp property import (#456)

**Status: ACCEPTED (2026-10-04).** Ordered work-unit forecast; each unit target ≤400 authored lines with tests alongside. Forecasts are estimates, not commitments.

1. **U1 — Schema, isolation, claims/references** (≈280–380 lines). Models for batch/candidate/work, external reference and claim/audit; unique/exclusive constraints, tenant registry, migration tests. Depends on accepted design and Neon migration coordination. Foundation; not independently useful to users.
2. **U2 — URL/publisher parsing, mapping, fixtures** (≈250–350). Canonical parser, publisher checks, city/province and feature/type/price mapping, Córdoba/CABA fixtures and contract tests. Depends U1 contracts; independently testable and shippable as library groundwork.
3. **U3 — Fixture-fed staging and idempotent confirmation** (≈350–400). Tenant staging, states, field edits, external reference uniqueness, permission revalidation, canonical creation/capacity reuse, partial retry. Depends U1/U2; earliest useful vertical slice, no Apify required.
4. **U4 — Verification ladder** (split into bounded children; not complete until all land):
   - **U4a — Pure domain signal** (corrected implementation pending native review/publication; ≤400 cumulative authored lines incl tests): normalized exact full-domain equality may signal context only for a verified active same-tenant `PRINCIPAL_MANAGER`; all outcomes require proof, including public-domain matches. No denylist, persistence, approval, or provenance acquisition. No behavioral RED was captured: the initial run failed because the renamed export was absent; focused suite 16/16 GREEN after implementation; full API suite 185 files / 1,870 tests, `tsc --noEmit`, lint, and diff check passed.
   - **U4b — Trusted provider/identity seam and atomic claim approval** (future): provider-sourced publisher contact + server-side current identity, approved-only conflict serialization/audit.
   - **U4c — Email challenge** (future): Resend delivery, HMAC challenge storage, TTL/attempt/resend limits.
   - **U4d — Listing-description proof and lifecycle operations** (future): bounded proof, audit, transfer/revoke contracts.
   Depends U1/U2 and sender verification; do not treat U4a policy output or a provenance label as runtime proof.
5. **U5 — Apify runs, webhook, durable work** (≈350–400). Pinned build, discovery/detail actors, bounded input/cost/concurrency/retries, secret webhook, batch/run/dataset binding, stale-run rejection, completeness accounting, leases, startup resume. Depends U1–U3 and the accepted work-row strategy; can ship behind unexposed integration boundary.
6. **U6 — R2 image pipeline** (≈350–400). Durable per-image work, SSRF-safe streaming/redirect/DNS/MIME/size/count checks, deterministic keys, per-image retry/results. Depends U1/U3 and verified storage integration; independently deployable after import confirmation.
7. **U7 — UI review/confirm and #459 handoff** (≈350–400). URL/proof/progress/review/edit/exclude/confirm/outcome states, owner-not-imported notice, BFF and authorization tests. Depends U3/U4; Apify progress integration from U5. User-facing completion slice.
8. **U8 — Explicit bounded smoke and operational closeout** (≈150–250). Opt-in authorized URL, item/cost ceilings, no normal-suite network; migration/Neon coordination checklist and runbook. Depends U5–U7; operationally independent, run only with separate approval.

## Dependencies and delivery recommendation

Primary path U1 → U2 → U3; U4 branches after U1/U2 and is required before production confirmation; U5 follows U1–U3; U6 follows U3; U7 integrates U3–U6; U8 follows integration. The user selected feature-branch-chain delivery: draft tracker PR to `develop`, then one child PR per work unit. Keep each work unit ≤400 authored lines and fixture-first where practical.

## U4a tracking

U4a corrected implementation is pending native review/publication on `feat/456-u4a-domain-policy`. The domain policy emits context signal only and requires proof for every outcome. Claims require a one-time code to the exact trusted provider-published agency address or bounded listing-description code fallback. Challenge persistence/atomic claim approval, sender integration, and listing proof remain future work; no manual operator review or new provider/identity integration is included. Commit `24cca3b5` contained the superseded denylist/eligibility draft; this correction removes that behavior without rewriting its history. U4 remains incomplete until U4b–U4d are delivered and reviewed.

## Test and operational gates

Each behavior-bearing unit uses focused tests alongside implementation. Contract tests cover parser/mapping drift, publisher mismatch, completeness/truncation and invalid price/currency. Security/concurrency tests cover tenant isolation, approved claim conflicts, webhook duplicate/stale events, challenge throttling, concurrent confirmation, capacity retry, unsafe image redirects and partial R2 outcomes. Standard tests use fixtures only. Smoke requires explicit opt-in and an authorized public page with configured cost/item limits. Coordinate additive schema migration with outstanding Neon work; do not run against Neon without authorization.

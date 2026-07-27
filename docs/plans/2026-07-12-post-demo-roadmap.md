# ViewPro / InmoView — Post-Demo Development Roadmap

_Dated 2026-07-12. Synthesized after the public demo went live in production
(2026-07-11). **Historical** — superseded for forward planning by
`2026-07-20-recta-final-execution.md` (the live ledger). The demo environment
described below was abandoned on 2026-07-26; production runs on
`app.inmoview.app`._

## Where we are

- **Track A (MVP feature execution): CLOSED.** All numbered slices (20.x–26.x)
  shipped. Seeded smoke green.
- **Demo LIVE in production** (2026-07-11): `https://demo.inmoview.app` (Vercel)
  + `https://api-demo.inmoview.app` (Dokploy / Hostinger VPS / Traefik) + Neon
  Postgres + Cloudflare R2 + Sentry. Verified end-to-end (`mvp-deploy-readiness/verify-evidence.md`).
- **Track B (platform split): Phases 1–3 done** (brand flip merged;
  `platform-contract` archived). Phases 4–6 not started.

## Backlog triage — real work vs. bookkeeping

Only **3** of the ~10 "pending" OpenSpec changes are real remaining work. The
rest are shipped; their unticked checkboxes are TDD test-matrix rows and
verification gates, not pending code (verified against git + on-disk modules).

| Shipped (noise — safe to leave/archive) | Real remaining work |
|---|---|
| `20-13-movement-outcomes` | `21-7-transactional-invitation-email` (M, gated on D2) |
| `24-6c-notification-deeplink-owner-movement` | `26-6a-inmoview-copy-pass` (S) |
| `23-3-whatsapp-tenant-contact-configuration` | `26-5a-inmoview-domain-handoff` (S–M, mostly done by the deploy) |
| `24-5-notification-routing-e2e` | |
| `26-2-1-visible-demo-property-fixtures` | |
| `22-8-seller-permission-hotfix` (closed by evidence) | |
| `mvp-plan-reorder` (docs-only, stale) | |

## The plan — three tracks

### Track 1 — Demo → Production (recommended #1)
Goal: onboard real inmobiliarias. Highest value now.

**Phase 1 — Production hardening (T-0 gates, non-negotiable before first tenant):**
1. Isolate prod from demo: dedicated Neon prod DB, separate API host,
   `app.inmoview.app` / `api.inmoview.app`, separate secrets.
2. Neon **pooled** endpoint + add `directUrl` to `schema.prisma` (the #1 scaling change).
3. Data-loss safety: never set `INMOVIEW_DEMO_*` in prod.
4. Scheduled Neon backups + one restore drill.
5. Sentry prod env + alert rules (including connection-saturation).
6. Fresh `ACCESS_TOKEN_SECRET`; cookies / CORS / rate-limit review.
7. Resolve the single-VPS SPOF (reevaluate Railway / Fly / Render / multi-node).

**Phase 2 — Go-live:** prod migrations → real tenant provisioning → onboard
first agencies → watch the connection-saturation "first wall".

### Track 2 — Product features (parallel, product-gated)
1. **`26-6a` copy pass** (S, no blocker) — role rename `Agente→Vendedor`,
   `Manager→Encargado` across all UI surfaces (brand→InmoView already done; keep
   `Cuenta Madre` and internal enums). Good polish before showing agencies.
2. **`21-7` transactional invitation email** (M) — real feature; no email
   provider wired yet. **Blocked on decision D2** (provider).
3. **`FB-8`** property image limit 5→10. **Blocked on decision D3.**

### Track 3 — Platform split (ViewPro-as-company) — large initiative
Phases 1–3 done. Remaining:
- **Phase 4** — `viewpro-web` + `viewpro-api` skeleton with its own DB.
- **Phase 5** — migrate `/admin` out of InmoView over the control lane.
- **Phase 6** — metrics panel over the data lane.
- ⚠️ **Blocked by an open design decision (D-plat):** where do platform
  operators authenticate once ViewPro is a separate app with its own DB?
  (`platform-foundation/proposal.md`). Resolve before Phase 4.

## Gating product decisions

| # | Decision | Unblocks |
|---|---|---|
| D2 | Email provider (Resend / SES / Postmark) | `21-7` email |
| D3 | Property image limit 5→10 | `FB-8` |
| D-plat | Platform-operator auth model | Track 3 Phase 4 |

## Recommended sequence

1. **`26-6a` copy pass** first — short, no blockers, polishes the UI for demos.
2. **In parallel: Track 1 Phase 1** (production hardening) — the highest-value
   path from "nice demo" to "product that charges".
3. **Track 3 (platform)** after go-live — heavy architecture, does not block
   having customers.

## Notes

- Repo layout: git + `openspec/` (SDD planning) + `docs/plans/` live at the repo
  root (`Viewpro/`); application code lives in `viewpro-app/`. SDD/OpenSpec work
  stays at the root; code work happens in `viewpro-app/`.
- SDD context was initialized 2026-05-14 (Engram topic `sdd-init/Viewpro`); no
  re-init needed.

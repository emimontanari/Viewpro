# ViewPro / InmoView — Plans Index

Cleaned up on 2026-07-26. This directory used to hold 126 files of per-slice
design and implementation records for MVP work that has all shipped. Those
records were deleted; they remain recoverable through git history. What is left
is only what still drives decisions.

## The four live documents

| Document | Use it for |
| --- | --- |
| [`2026-07-20-recta-final-execution.md`](./2026-07-20-recta-final-execution.md) | **The live ledger.** Current status, open work, code-audit findings, and the open commercial decisions (D1–D5). Updated on `develop` at every merge. Start here. |
| [`2026-07-21-production-go-live-runbook.md`](./2026-07-21-production-go-live-runbook.md) | Deployed production topology: the 4 services, env var matrix per service, migration and seed commands, smoke checks. Executed 2026-07-22. |
| [`2026-06-24-platform-backoffice-vision.md`](./2026-06-24-platform-backoffice-vision.md) | Why the product/platform split exists and the commercial model (manual plans, no payment gateway). Referenced by the ledger. |
| [`2026-07-12-post-demo-roadmap.md`](./2026-07-12-post-demo-roadmap.md) | Historical origin of the current roadmap. Its demo environment is dead — see below. |

`2026-06-04-final-mvp-execution-plan.md` is kept as the historical anchor for
MVP gates, non-goals, and the slice template. It is never rewritten, and it
references documents that no longer exist.

## Where the contract lives now

Plans describe intent. For what the system is **required** to do, read the
consolidated capability specs:

```
openspec/specs/<capability>/spec.md
```

21 capabilities, consolidated on 2026-07-26 from the SDD changes that shipped
them (audit log, step-up reauth, tenant cancel, operator roles, data lane,
tenant registry, operator console, and more). Each file carries `<!-- Source -->`
comments pointing at the change it came from.

Completed changes live in `openspec/changes/archive/` — historical evidence,
not directives. New product or source work starts with a new change under
`openspec/changes/`.

## Production

Production has been live since 2026-07-22:

| Surface | URL |
| --- | --- |
| App (real users) | https://app.inmoview.app |
| Product API | https://api.inmoview.app |
| Operator console | https://console.inmoview.app |
| Platform API | https://api-console.inmoview.app |

**The demo environment is dead.** `api-demo.inmoview.app` returns 502 and was
abandoned on 2026-07-26. Do not share demo URLs or the credentials in
`docs/INMOVIEW_DEMO_HANDOFF.md` (kept only as a deprecated historical record).
Client demos run on production with a real self-service account.

Never set `INMOVIEW_DEMO_*` or `VIEWPRO_DEMO_PASSWORD` in production, and never
run `pnpm demo:seed` against the production database — the `seed-demo-safety.mjs`
guard is a substring match on `DATABASE_URL`.

## Excluded from scope

The MVP plan deliberately excludes, and these remain excluded until the ledger
says otherwise: external billing gateways (MercadoPago is Etapa 3), WhatsApp
Business API, realtime notifications, AI/chat/marketplace, buyers/renters as
users, native mobile, advanced BI, platform-owner impersonation, and admin
access to private tenant document content.

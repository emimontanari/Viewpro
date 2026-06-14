# Proposal — Stage 26.5a InmoView Domain, Branding, and Demo Handoff

**Status:** proposed, no product decision required (confirmed P0 in audit).
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-11.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase E, slice E3.

## Slice contract

```txt
Stage: 26
Slice: 26.5a — InmoView domain, branding, and demo handoff
Objective: make the pilot demo reachable and understandable as InmoView while preserving ViewPro as umbrella context where needed.
Evidence needed: `inmoview.app` DNS/deploy proof, env checklist, smoke run, seeded demo credentials, and no starter/template route exposure.
Do not touch: package-wide technical renames unless required, subdomain architecture, billing/Stripe, marketplace.
Done: Pato can open the deployed app, log in with demo accounts, and show the pilot safely.
Next slice: Stage 26.6 pilot-ready deck.
```

## Scope

- DNS for `inmoview.app` (or agreed pilot domain) routed to staging.
- Env checklist confirmed against `26.5` (storage, auth, CORS, DB, Sentry).
- Seeded demo credentials prepared for the handoff (manager, sellers, owner, admin per `26.2` seed contract).
- Final route inventory before handoff confirms no template/starter route is reachable (G2 must have passed).

## Out of scope

Package-wide technical renames (`viewpro-app`, `@viewpro/api`, etc.) unless explicitly required; subdomain architecture changes; billing or Stripe integration; marketplace or public portal work.

## Dependency

Runs after `26.4` security/isolation and `26.5` staging checklist; cannot run before G2 PR #140 route revalidation passes.

## Next phases

Move to SDD `sdd-explore` once Phase E reaches E2.

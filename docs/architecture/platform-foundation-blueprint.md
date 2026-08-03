# Platform Foundation Blueprint — ViewPro (platform) / InmoView (product)

North-star architecture for splitting one app into a product (InmoView) and a platform (ViewPro) that can govern N products and aggregate their data. This is the "roots" document for Phases 2–6. Phase 1 (brand extraction) is detailed separately in `openspec/changes/archive/platform-foundation/design.md`. Discipline throughout: **design the seams so adding a product or role is cheap — do NOT build federation for products that don't exist.**

## Mental model (locked)

- **InmoView** = a PRODUCT of the company. Real-estate agencies (tenants / cuenta madre) and their staff are the users. It owns its operational DB and its own access state (`Tenant.status`, soft-limits).
- **ViewPro** = the COMPANY / internal control plane. Only company staff (operators) use it. Agencies NEVER authenticate against ViewPro — they are governed subjects, not users.
- **Design B (locked)**: the product owns its access state; ViewPro NEVER reaches into a product's operational DB. Regla de oro: the platform never touches a product's internals.

Source decisions: `architecture/viewpro-platform-topology` (#4484), `decision/platform-backoffice-vision` (#4475), `decision/platform-admin-access-model` (#4477).

---

## 1. Topology and target monorepo layout

Current reality (explore #4487): a NESTED Turborepo at `viewpro-app/` (the git root only holds docs). Apps: `apps/api` (`@viewpro/api`, NestJS, owns Prisma + the single Postgres `viewpro`), `apps/app-new` (Next.js, the product), `apps/web` (empty stub). Packages: `@viewpro/contracts` (stub), `@viewpro/config`.

Target layout — reached INCREMENTALLY from today, not in one cut:

```
viewpro-app/
  apps/
    app-new/        # = InmoView product web (rename to inmoview-web later, low priority)
    api/            # = InmoView product API   (rename to inmoview-api later, low priority)
    viewpro-web/    # NEW (Phase 4): platform operator console
    viewpro-api/    # NEW (Phase 4): platform API + its OWN DB
  packages/
    platform-contract/   # NEW (Phase 3): the two-lane seam as TYPES only
    config/              # stays (@viewpro/config = company namespace)
    contracts/           # existing stub; may host product OpenAPI client
```

Key topology rules:
- `@viewpro/*` package scope STAYS — it is the company namespace, and the company IS ViewPro. App-directory renames (`app-new`→`inmoview-web`) are cosmetic and deferred; they are NOT a blocker for the split.
- `viewpro-api` gets its OWN Postgres (clearly-named, e.g. `viewpro_platform`), NEVER the product's `viewpro` DB. It owns: operator identity, audit log, product registry, plan presets, and the aggregated read store.
- Two databases, two deploy units, one monorepo. The monorepo is the seam holder; the DBs enforce Design B isolation physically.

---

## 2. The two-lane contract (concrete)

`packages/platform-contract` (Phase 3) declares both lanes as TypeScript types shared by both sides. No runtime framework — types + a thin client interface. One product (InmoView) implements them; the seam is built once.

### 2.1 CONTROL lane (down): ViewPro → product admin API

Purpose: low-volume command/response — suspend a tenant, change limits, change plan. The product stays autonomous: if ViewPro is down, InmoView keeps enforcing its own local access state.

| Aspect | First implementation (recommended) | Why |
|--------|-----------------------------------|-----|
| Transport | HTTPS request/response, InmoView exposes an INTERNAL admin endpoint group (e.g. `/internal/platform/tenants/:id/status`) | Reuses the existing NestJS API; no broker needed for low-volume commands |
| Trust across boundary | A signed service token (shared secret HS256 or mTLS) identifying ViewPro as the caller, validated by a dedicated `PlatformControlGuard` on InmoView — SEPARATE from user `AuthGuard` | The caller is a SERVICE, not a user; do not reuse user JWT/cookies |
| Idempotency | Command carries an idempotency key; InmoView records it | Commands may retry; access changes must not double-apply |
| Audit | ViewPro writes the audit record (who/what/when/old→new) in ITS OWN DB; InmoView records the applied change locally | Audit is a platform asset (#4475 D3); today it lives in the product and must move |

This directly resolves the explore coupling gotcha: today extracting `/admin` is hard because `GlobalAdminGuard` is DI-coupled to `UsersRepository`. The control lane replaces "reach into the product DB" with "call the product's own guarded endpoint".

### 2.2 DATA lane (up): products publish domain data into ViewPro's read store

Purpose: ViewPro shows "all properties of all agencies" WITHOUT cross-tenant scans on the product DB or live API fan-out. Products PUBLISH; ViewPro queries its own aggregated copy.

Transport options, simplest-viable-first:

| Option | Cost | When |
|--------|------|------|
| **(A) Outbox + polling ingest (RECOMMENDED FIRST CUT)** | Low — one `OutboxEvent` table in InmoView, a ViewPro ingest job polling/pulling a `/internal/platform/changes?since=` cursor endpoint | One product, modest volume. No broker, no infra. Honors Design B (ViewPro pulls a published feed, never scans the product DB). |
| (B) Message broker (events) | Medium — Redis Streams / NATS / SQS | Multiple products or higher volume later |
| (C) CDC (logical replication) | High — Debezium/wal2json pipeline | Large scale; over-built for today |

Recommendation: **Option A (transactional outbox + cursor-pull ingest)** for the first cut. InmoView writes domain changes to an outbox in the same transaction as the change; ViewPro pulls them on a cursor into its read store. This is the simplest thing that honors the publish direction and keeps tenant data out of ViewPro's live path. Do NOT build a broker or CDC pipeline until a second product or volume demands it — that is the "don't build for a team of 1" guardrail applied to data.

Data-governance note: ViewPro aggregating ALL agencies' data crosses tenant isolation BY DESIGN (the company owns the platform). This warrants an explicit policy/audit stance when the data lane is built (Phase 6), not silent cross-tenant reads.

---

## 3. Operator-auth resolution (REQUIRES USER CONFIRMATION)

The key open question from the proposal: once ViewPro is a separate app with its OWN DB, WHERE do platform operators (company staff) authenticate? Today `GlobalAdminGuard` re-fetches the operator from InmoView's SHARED DB via `UsersRepository` — under Design B autonomy that makes ViewPro depend on InmoView to log in, contradicting autonomy.

### Options on the table

| Option | How it works | Trade-offs |
|--------|--------------|-----------|
| **(1) ViewPro owns its own operator identity table (RECOMMENDED)** | `viewpro-api` DB has its own `Operator` table + its own login (own JWT, own cookie names per Guardrail 2). First operator seeded via migration/bootstrap; afterwards an existing operator invites others (#4477 "how admins are born"). | + Full autonomy — ViewPro logs in even if InmoView is down. + Clean Design B (no shared DB). + Naturally enforces the mutual-exclusion invariant (#4477): operators live in a DIFFERENT table than tenant users, so a user physically CANNOT be both. − One-time migration of existing `VIEWPRO_ADMIN` operators out of the product DB into ViewPro's. |
| (2) Token introspection against InmoView | ViewPro delegates auth to an internal endpoint InmoView exposes (`/internal/auth/introspect`). | − Availability coupling: ViewPro can't log operators in if InmoView is down (violates autonomy). − Keeps operator identity in the product DB, against Design B. |
| (3) Keep shared identity now, migrate later | Operators stay in InmoView's DB through Phase 5; physical split deferred. | + Lowest immediate cost, matches #4477's "logical separation, not physical (for now)". − Postpones the autonomy problem into Phase 4/5 where it blocks the split. − Re-introduces the DI coupling the control lane is meant to remove. |

### Recommendation

**Adopt Option 1 — ViewPro owns its own operator identity table** — at Phase 4, when `viewpro-api` and its DB are created. It is the only option that fully satisfies Design B autonomy AND turns the mutual-exclusion invariant from an app-enforced rule into a physical fact (separate tables, separate identity stores). The migration cost (moving existing operators) is small and one-time.

**How this reconciles with / revises `decision/platform-admin-access-model` (#4477):**
- #4477 chose "logical separation, not physical — reuse the single login" UNDER THE ASSUMPTION that ViewPro lived inside InmoView. The topology decision (#4484) invalidated that assumption: ViewPro is now a separate app with its own DB.
- This blueprint REVISES #4477 step 2 for the post-split world: physical separation arrives at Phase 4 (own identity store), not "later, maybe". The mutual-exclusion invariant (#4477 step 1) is PRESERVED and strengthened — it becomes structural rather than a constraint to police.
- #4477's hardening package (MFA for admins, step-up re-auth, server-side `/admin` protection, real post-login routing, shorter idle timeout) still applies and lands with the ViewPro console (Phase 4/5).

> **This recommendation requires explicit user confirmation before Phase 4 begins.** It is presented as a recommendation, not a settled decision, because it revises a previously user-confirmed decision (#4477). The orchestrator should surface it at the next interactive checkpoint.

---

## 4. Phase sequencing, dependencies, and guardrails

```
P1 brand extract ──► P2 brand flip ──► P3 platform-contract (types)
                                            │
                                            ▼
                                       P4 viewpro app + OWN DB + operator identity
                                            │   (operator-auth decision lands here)
                                            ▼
                                       P5 migrate /admin over CONTROL lane
                                            │
                                            ▼
                                       P6 metrics panel over DATA lane
```

| Phase | Delivers | Depends on | Guardrails that bite here |
|-------|----------|-----------|---------------------------|
| P1 | Brand constant + naming ADR | — | **G1** (naming ADR documents `viewpro_*` = pre-split prefix) |
| P2 | User-visible flip to InmoView (brand constant values only) | P1 | **G3** (audit the public/integrator surface — Swagger title flips with the brand) |
| P3 | `platform-contract` package — both lanes as types, no runtime | P2 (stable names) | seam-only discipline (types, not infra) |
| P4 | `viewpro-web` + `viewpro-api` + OWN DB + operator identity (Option 1) | P3 | **G2** (own cookie names + own clearly-named DB; NEVER inherit `viewpro_access_token`); operator-auth decision (§3) |
| P5 | `/admin` migrated out of InmoView, talking over the control lane | P4 | control-lane trust model (§2.1); #4477 hardening package |
| P6 | Platform metrics over the aggregated read store (data lane) | P4, P5 | **G4** (DB-name/localStorage renames deferrable with grace periods); cross-tenant data-governance stance (§2.2) |

The four guardrails (proposal §Guardrails) map to the phases where each first matters: G1→P1, G3→P2, G2→P4, G4→P6.

## Checklist (blueprint integrity)

- [ ] Topology locked: InmoView product / ViewPro platform, two DBs, one monorepo.
- [ ] Control lane: service-token trust, separate from user auth, audit in ViewPro's DB.
- [ ] Data lane first cut = transactional outbox + cursor-pull ingest (Option A); no broker/CDC yet.
- [ ] Operator-auth: Option 1 recommended, FLAGGED for user confirmation, reconciled with #4477.
- [ ] Phases sequenced with dependencies; 4 guardrails mapped to phases.
- [ ] Seam discipline held: build once for InmoView, design for N.

## Next step

Confirm the operator-auth recommendation (§3) before Phase 4. Continue Phase 1 via `sdd-tasks` using `openspec/changes/archive/platform-foundation/design.md`.

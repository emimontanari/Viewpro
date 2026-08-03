# Proposal: Platform Foundation — Product/Platform Split (Phase 1)

Plant the roots for a multi-product platform by separating two concerns: **ViewPro = the company / internal control plane**, **InmoView = a product of the company** (the real-estate app agencies use). This proposal frames the whole 6-phase initiative and scopes the FIRST shippable slice to **Phase 1: brand-constant extraction + a naming ADR** — a safe, isolated enabler that makes every later phase cheap.

## Mental model (encode, do not re-debate)

- Agencies + their staff use **InmoView**. Only company staff use **ViewPro**. Agencies NEVER authenticate against ViewPro — they are governed subjects, not users.
- Architecture is ALREADY DECIDED upstream; this change ENCODES it, it does not re-open it.

## Intent

Today everything is named "viewpro" and the platform back-office (`/admin`) lives inside the product, sharing its DB. To grow into a platform that governs N products and aggregates their data, we must split product from platform. The blast radius of a naive rename is ~250 "viewpro" hits with real breakage risk (logout-all, enum migrations). Phase 1 removes that risk by centralizing brand strings and writing down the naming model — so the later brand flip is a one-line change instead of a 50-file edit.

## Scope

### In scope (Phase 1 — the first slice)
- Extract the ~50 scattered user-visible "ViewPro" brand literals into a single source of truth (one brand constant module).
- Write a one-page **naming ADR** documenting the model: `viewpro_*` plumbing is the pre-split company-era prefix and stays; the `@viewpro/*` package scope stays = company namespace.
- Leave runtime behavior byte-identical (pure extraction; no user-visible string changes yet).

### Out of scope now (later phases — context, not deliverables)
- **Phase 2**: brand flip → InmoView (user-visible strings only).
- **Phase 3**: `platform-contract` package — the two lanes as types.
- **Phase 4**: ViewPro platform app skeleton (`viewpro-web` + `viewpro-api`) with its OWN DB.
- **Phase 5**: migrate `/admin` out of InmoView into ViewPro, talking over the control lane.
- **Phase 6**: metrics panel over the data lane.

## Non-goals (explicit)
- **NO plumbing renames**: cookie names (`viewpro_access_token`), the `VIEWPRO_ADMIN` Postgres enum value, `localStorage viewpro:selected-tenant:v1`, DB name `viewpro` — all stay. Churn + real breakage, zero user value. `VIEWPRO_ADMIN` stays semantically correct (ViewPro = platform).
- **NO payment gateway** — plans are manual limit presets, not Stripe/MercadoPago.
- **NO federation/pipeline infra for products that don't exist** — design the seam once, implement once for InmoView. "Design the seams so adding a product/role is cheap, NOT build everything for a team of 1."

## Decided constraints (carry forward as architecture inputs)

| Constraint | Decision |
|------------|----------|
| Governance model | **Design B** — product owns its access state; ViewPro NEVER touches a product's operational DB. |
| Two-lane contract | **Control/down**: ViewPro → product admin API (suspend/limits/plan), low-volume req/res, product autonomous if ViewPro is down. **Data/up**: products PUBLISH domain data (async) into ViewPro's OWN read store; ViewPro queries its aggregated copy, never live cross-tenant scans. |
| ViewPro DB owns | Platform operator identity, audit log, product registry, plan presets, aggregated read store. The read store is itself a platform asset (future portal / CRM). |

## Guardrails (bake in across phases)
1. One-page naming ADR (delivered in Phase 1) documenting `viewpro_*` = pre-split company prefix.
2. Phase-4 rule: the platform app uses its OWN cookie names + its OWN clearly-named DB. NEVER inherit `viewpro_access_token` (cookie-collision risk across shared/related domains).
3. Audit the **public** API/contract surface specifically (e.g. Swagger "ViewPro API"): internal names free, anything integrators see must match the brand.
4. Keep the door open: DB-name and localStorage renames are deferrable later with grace periods, only where friction justifies.

## Capabilities

### New Capabilities
- `brand-constants`: single source of truth for user-visible product brand strings (name, legal copy, sign-in title, Swagger title), consumed by InmoView FE + API.

### Modified Capabilities
- None (Phase 1 is a pure, behavior-preserving extraction; later phases will modify capabilities).

## Approach

Centralize the ~50 raw "ViewPro" literals (titles, legal copy, sign-in, brand header, Swagger title) into one brand-constant module referenced by both `apps/app-new` (FE) and `apps/api` (Swagger). Replace each literal with a reference. Author the naming ADR alongside, documenting why plumbing identifiers keep the `viewpro_*` prefix. No plumbing identifier, cookie, enum, DB name, or package scope changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/app-new/src` (~50 files w/ brand literals) | Modified | Replace raw "ViewPro" strings with brand-constant references |
| brand-constant module (new) | New | Single source of truth for user-visible brand strings |
| `apps/api` Swagger setup ("ViewPro API") | Modified | Reference brand constant for the public API title |
| `docs/adr` (or repo ADR location) | New | One-page naming ADR |
| Plumbing (cookies, `VIEWPRO_ADMIN` enum, DB name, `@viewpro/*`) | Untouched | Explicitly preserved by decision |

## Open design tension (flag for DESIGN phase — do NOT resolve here)

**Where do platform operators (company staff) authenticate once ViewPro is a separate app with its own DB?** Today `GlobalAdminGuard` re-fetches the operator from InmoView's SHARED DB (injects `UsersRepository` via DI). Under Design B autonomy, keeping operators in InmoView's DB makes ViewPro depend on InmoView to log in — contradicting autonomy. This REVISITS `decision/platform-admin-access-model` (which assumed ViewPro lived inside InmoView). **The design phase must resolve this before Phase 4/5.** Phase 1 is unaffected.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing a brand literal during extraction | Med | Grep-driven inventory before/after; the ADR makes the canonical list discoverable |
| Scope creep into brand flip or plumbing rename | Med | Non-goals are explicit; Phase 1 changes references only, never the string values |
| Operator-auth tension resolved too late, blocking Phase 4/5 | High (downstream) | Named now as the key design question; out of Phase 1 scope but tracked |
| ADR contradicts later product naming decisions | Low | ADR scoped to the agreed split; revisited only if the macro decision changes |

## Rollback Plan

Phase 1 is a pure extraction with no behavior change. Rollback = revert the brand-constant module and restore inline literals (single commit / PR revert). No data, migration, cookie, or enum changes to undo. The ADR is documentation — harmless if reverted.

## Dependencies

- Macro decisions already recorded: `architecture/viewpro-platform-topology` (Design B + two-lane), `decision/platform-backoffice-vision`, `decision/platform-admin-access-model`. Phase 1 has no external dependency.

## Success Criteria

- [ ] All ~50 user-visible "ViewPro" brand literals reference a single brand-constant source.
- [ ] Swagger / public API title is sourced from the brand constant.
- [ ] One-page naming ADR exists documenting `viewpro_*` = pre-split company prefix and what stays vs. flips.
- [ ] No plumbing identifier, cookie, enum, DB name, or package scope changed.
- [ ] Runtime behavior is byte-identical (no user-visible string change yet).
- [ ] A later brand flip can be done by editing the brand constant only.

## Proposal question round (interactive review — answer, skip, or correct)

These would sharpen the proposal; assumptions are noted so you can correct the framing.

1. **Brand-constant location/shape** — assumed a shared TS module consumed by both FE and API. Is a `@viewpro/*` shared package preferred over an app-local constant, given the Swagger title also needs it? (decision gap)
2. **ADR home** — assumed a repo ADR location (e.g. `docs/adr/`). Where do you want the naming ADR to live so it's the canonical reference? (signposting)
3. **Brand-literal completeness bar** — assumed "user-visible strings only" (titles, legal copy, sign-in, Swagger). Should emails, PWA manifest, or meta/SEO tags be in the Phase 1 inventory too, or deferred to the Phase 2 flip? (scope boundary)
4. **Phase 1 = extraction only** — assumed values stay "ViewPro" for now (flip is Phase 2). Confirm you do NOT want the actual user-visible flip to InmoView folded into this first slice. (scope boundary / business risk)

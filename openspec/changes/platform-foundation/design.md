# Design: Platform Foundation — Phase 1 (Brand-Constant Extraction)

Phase 1 turns ~50 scattered `"ViewPro"` brand literals into one app-local source of truth per app, and writes a one-page naming ADR. The runtime stays byte-identical (values still read `"ViewPro"`); the only thing that changes is WHERE the strings come from. This document is scoped to Phase 1. The macro north-star for Phases 2–6 lives in `docs/architecture/platform-foundation-blueprint.md`.

## Quick path

1. Create `apps/app-new/src/lib/brand/brand.ts` (FE brand constant) and `apps/api/src/bootstrap/brand.constants.ts` (API brand constant — Swagger only).
2. Replace each user/integrator-visible `"ViewPro"` literal with a reference to the constant. No value changes.
3. Write `docs/adr/0001-naming-model.md`.
4. Verify completeness with the grep inventory (before/after counts must reconcile), and verify behavior with the diff-of-rendered-output check.

## Scope discipline (non-negotiable)

| Decision | Source |
|----------|--------|
| App-local constant per app, NOT a shared `@viewpro/*` package | Resolution #1 (#4490) — brand is per-product by nature |
| Values stay `"ViewPro"`; the flip to InmoView is Phase 2 | Resolution #4 (#4490) |
| ADR home is `docs/adr/0001-naming-model.md` | Resolution #2 (#4490) |
| Completeness bar = anything a USER or INTEGRATOR sees | Resolution #3 (#4490) |
| Plumbing untouched (cookies, `VIEWPRO_ADMIN` enum, DB name, `@viewpro/*`) | Proposal non-goals; explore #4487 §7B |

---

## A. Brand-constant module shape

### A.1 FE module — `apps/app-new/src/lib/brand/brand.ts`

Rationale for location: `src/lib/` already hosts cross-cutting app concerns (`session.ts`, `utils.ts`); brand is exactly that. A single flat file is enough for Phase 1 — no `index.ts` barrel, no folder ceremony. It is imported by Server Components (metadata), Client Components (sign-in / sidebar), and static legal pages alike, so it must be a plain module with NO `"use client"` / `"use server"` directive and NO runtime dependency (pure constants).

The object is `as const` and typed, so a later flip is a single-edit, type-checked change:

```ts
// apps/app-new/src/lib/brand/brand.ts
// Single source of truth for user/integrator-visible brand strings.
// Phase 1: values intentionally still read "ViewPro" (the flip to InmoView is Phase 2).
// Plumbing identifiers (cookie names, VIEWPRO_ADMIN enum, DB name, @viewpro/* scope)
// are NOT brand — see docs/adr/0001-naming-model.md.

export const BRAND = {
  // Core identity
  productName: 'ViewPro',
  legalEntity: 'ViewPro',
  teamName: 'Equipo ViewPro',

  // Metadata / titles (Next Metadata API)
  appTitle: 'ViewPro',
  dashboardTitle: 'ViewPro Dashboard',
  adminTitle: 'Admin ViewPro',
  defaultDescription: 'Panel de ViewPro para inmobiliarias',

  // Marketing / about
  tagline:
    'ViewPro nos ayuda a ordenar propiedades, contactos y seguimiento comercial en un solo lugar.',

  // Auth surface copy keys (sign-in / sign-up panels)
  signInContinue: 'Ingresá para continuar con ViewPro.',
  signUpContinue: 'Creá tu cuenta para continuar con ViewPro.',

  // Legal copy references (Terms / Privacy) — see A.3 for strategy
  // (long-form copy stays in its page; only the brand TOKEN is referenced)

  // SEO / Open Graph (added in Phase 1 inventory even if not all are wired yet)
  ogSiteName: 'ViewPro',

  // PWA manifest fields (manifest does NOT exist yet — see Inventory note I.4)
  manifest: {
    name: 'ViewPro',
    shortName: 'ViewPro',
    description: 'Panel de ViewPro para inmobiliarias'
  }
} as const;

export type Brand = typeof BRAND;
```

Exposed keys (the agreed surface): product name, sign-in/sign-up titles, dashboard/admin titles, default meta description, tagline, team name, legal entity, OG site name, and PWA manifest fields. The keys are grouped by surface (identity / metadata / auth / legal / SEO / PWA) so a reader recognizes coverage at a glance instead of recalling a flat list.

### A.2 API module — `apps/api/src/bootstrap/brand.constants.ts`

Rationale: the API needs exactly two brand strings (Swagger title + description). It must NOT import the FE module (separate app, separate tsconfig project, separate deploy unit — that coupling is precisely what Resolution #1 rejected). A minimal local constant beside `create-app.ts`:

```ts
// apps/api/src/bootstrap/brand.constants.ts
// Minimal brand constant for the PUBLIC API surface (Swagger).
// Integrator-visible (Guardrail 3) → must track the brand. Internal identifiers do not.
export const API_BRAND = {
  apiTitle: 'ViewPro API',
  apiDescription: 'REST API for ViewPro'
} as const;
```

Wired in `create-app.ts`:

```ts
.setTitle(API_BRAND.apiTitle)
.setDescription(API_BRAND.apiDescription)
```

### A.3 Legal copy strategy (Terms / Privacy)

The Terms and Privacy pages contain ~15 inline `"ViewPro"` mentions woven into prose (`terms-of-service/page.tsx`, `privacy-policy/page.tsx`). Extracting every sentence into the constant would bloat it and hurt readability. Decision:

- Reference the brand TOKEN inside the JSX, not the whole sentence: `Welcome to {BRAND.productName}.` This keeps prose editable in place while the brand name flips from one source.
- This satisfies the completeness bar (every visible `"ViewPro"` becomes a reference) without turning legal prose into config.

---

## B. Naming ADR outline — `docs/adr/0001-naming-model.md`

`docs/adr/` does not exist yet; Phase 1 creates it with `0001` as the first record. Outline:

```markdown
# 0001 — Naming Model: Brand vs. Plumbing

## Status
Accepted — 2026-06-24

## Context
Everything is named "viewpro". The company is becoming a platform (ViewPro)
with a product (InmoView). A naive rename is ~250 hits with real breakage
(logout-all on cookie rename, ALTER TYPE on the enum). We must distinguish
what is BRAND (user/integrator-visible, will flip) from what is PLUMBING
(invisible runtime identifiers, stay).

## Decision
Two classes of "viewpro" identifier:

| Class | Examples | Rule |
|-------|----------|------|
| Brand (visible) | UI copy, titles, legal, Swagger title, PWA/SEO | Centralized in a brand constant; flips to InmoView in Phase 2 |
| Plumbing (invisible) | `viewpro_access_token` / `viewpro_refresh_token` cookies, `VIEWPRO_ADMIN` Postgres enum, `viewpro:selected-tenant:v1` localStorage, DB name `viewpro`, `@viewpro/*` package scope | STAYS as the pre-split company-era prefix |

`viewpro_*` is the company-era prefix and remains correct: ViewPro is the
COMPANY/PLATFORM. `VIEWPRO_ADMIN` stays semantically accurate (a ViewPro =
platform operator). `@viewpro/*` is the company namespace and stays.

## Consequences
- Phase 2 brand flip = edit the brand constant only.
- Plumbing renames are deferred and only done later with explicit grace
  periods (cookie dual-read, enum migration) where friction justifies — not now.
- Reviewers can classify any future "viewpro" hit against this table.

## Rejected alternatives
- Full rename now → logout-all + enum migration + churn, zero user value.
- Renaming the package scope `@viewpro/*` → it is the company namespace, correct as-is.
```

The ADR is the canonical, greppable reference that makes the brand/plumbing boundary auditable for every later phase.

---

## C. Inventory method (grep-driven, completeness-verifiable)

The goal: find ALL user/integrator-visible literals so Phase 2's flip is genuinely one-place. The method has three passes and a reconciliation step.

### C.1 Pass 1 — raw census (baseline count)

```bash
cd viewpro-app
# Total raw hits, FE app source, excluding tests:
rg -n 'ViewPro' apps/app-new/src --glob '!**/*.test.*' --glob '!**/*.spec.*'
# API source:
rg -n 'ViewPro' apps/api/src --glob '!**/*.spec.*'
```

### C.2 Pass 2 — classify each hit (visible vs plumbing vs noise)

Each hit falls into exactly one bucket. The classification is the heart of completeness:

| Bucket | Action | Concrete locations (from explore #4487 + this audit) |
|--------|--------|------|
| Visible UI copy | Extract → `BRAND.*` | `app/layout.tsx` (title, description), `app/dashboard/layout.tsx`, `app/admin/page.tsx`, `components/layout/app-sidebar.tsx`, `features/auth/components/sign-in-view.tsx`, `features/auth/components/sign-up-view.tsx`, `features/admin/components/admin-tenant-management-page.tsx`, `features/dashboard/components/operational-homepage.tsx`, `features/team-invitations/components/team-invitation-acceptance-view.tsx`, `features/owner-invitations/components/owner-invitation-acceptance-view.tsx` |
| Visible legal/marketing | Extract token in prose | `app/terms-of-service/page.tsx`, `app/privacy-policy/page.tsx`, `app/about/page.tsx` |
| Visible metadata (per-route) | Extract → `BRAND.*` | `app/owner-invitations/[token]/page.tsx`, `app/team-invitations/[token]/page.tsx` (metadata `title`/`description`) |
| Integrator-visible (public API) | Extract → `API_BRAND.*` | `apps/api/src/bootstrap/create-app.ts` (Swagger title + description) |
| Plumbing / NOT brand | Leave untouched | `apps/api/src/auth/auth.constants.ts` (cookie names), `admin/guards/global-admin.guard.ts` error string `'ViewPro admin access required'` (operator-facing internal — borderline; see C.5), `common/date/business-tz.ts` (code comment) |
| Code comments (`// ViewPro backend ...`) | Leave untouched (not user-visible) | all `app/api/products/**/route.ts` header comments |

### C.3 Pass 3 — surfaces that have NO literal today (gaps to record, not extract)

Critical finding from this audit — two expected surfaces do not exist yet:

- **PWA manifest**: there is NO `manifest.ts` / `manifest.json` / `site.webmanifest` in `apps/app-new`. The `BRAND.manifest` keys are defined for Phase 2 readiness but wire to nothing in Phase 1. Recorded so Phase 2 does not "discover" a missing surface.
- **Transactional emails**: there is NO branded email system. `apps/api/src/notifications/` is in-app notifications; `notification-link.helper.ts` builds URLs, not branded email bodies. No email brand literal exists to extract. Recorded as "no surface" so the inventory is provably complete, not silently incomplete.

This is why Pass 3 matters: completeness means accounting for surfaces that SHOULD have brand but don't, so the inventory is exhaustive by construction.

### C.4 Reconciliation (the completeness proof)

```
raw_hits (Pass 1)
  = extracted (Pass 2 visible buckets)
  + left_untouched_documented (Pass 2 plumbing/comment buckets)
```

After extraction, re-run Pass 1. Every remaining `ViewPro` hit MUST be a documented plumbing/comment entry from C.2 or a literal value inside `brand.ts` / `brand.constants.ts` themselves. If any UNCLASSIFIED visible hit remains, the inventory was incomplete — fix before merge. This reconciliation is the mechanical guarantee that Phase 2 is one-place.

### C.5 Borderline call — `GlobalAdminGuard` error string

`'ViewPro admin access required'` is surfaced in an API error to a platform operator (company staff), not to an agency/integrator. Per the bar "visible to someone outside our team → extract", this is INTERNAL → leave it untouched in Phase 1, and note it in the ADR consequences. (It also references the operator role, which stays `VIEWPRO_ADMIN` semantically.) Flagged here so the reviewer sees the call was deliberate, not missed.

---

## D. Byte-identical / behavior-preserving guarantee

Phase 1 changes references, never values. The guarantee is checked two ways:

1. **Value-identity check**: every `BRAND.*` / `API_BRAND.*` value is the exact prior literal (same casing, accents, punctuation — e.g. `'Panel de ViewPro para inmobiliarias'`, `'Equipo ViewPro'`). A grep diff of the OLD literals vs the constant values must show zero textual difference.
2. **Rendered-output check**: build both apps and confirm no user-visible string changed.
   ```bash
   cd viewpro-app
   pnpm --filter next-shadcn-dashboard-starter build   # FE compiles, metadata intact
   pnpm --filter @viewpro/api build                    # API compiles, Swagger title intact
   pnpm --filter next-shadcn-dashboard-starter test     # existing brand assertions still pass
   ```
   Existing tests already assert brand strings (e.g. `sign-in-view.test.ts`); they must pass UNCHANGED. If a test references the literal, it keeps passing because the value is identical — that is the regression net.
3. **No-plumbing-touched check**: `git diff` must NOT include `auth.constants.ts` cookie names, the Prisma enum, the DB name, or `package.json` scopes. If it does, scope creep happened.

## Checklist

- [ ] `apps/app-new/src/lib/brand/brand.ts` created, `as const`, no client/server directive.
- [ ] `apps/api/src/bootstrap/brand.constants.ts` created; `create-app.ts` references it.
- [ ] Every visible hit from C.2 references a constant; legal prose references the token.
- [ ] `docs/adr/0001-naming-model.md` created with the brand/plumbing table.
- [ ] Reconciliation (C.4) passes: no unclassified visible `ViewPro` remains.
- [ ] PWA-manifest-absent and email-absent gaps recorded (C.3).
- [ ] Builds + existing tests pass unchanged; no plumbing file in the diff.

## Next step

Proceed to `sdd-tasks` once the spec is ready. The macro blueprint (`docs/architecture/platform-foundation-blueprint.md`) governs Phases 2–6 and carries the operator-auth decision that requires user confirmation before Phase 4.

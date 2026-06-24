# Tasks: Platform Foundation — Phase 1 (Brand-Constant Extraction)

> Scoped to Phase 1 only. Values stay `"ViewPro"`. No visible change to any user-facing string. Behavior-preserving extraction only.

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated new/changed lines | ~240–310 |
| 400-line budget risk | **Medium** — well under budget; one PR is appropriate |
| Chained PRs recommended | **No** |
| Suggested split | N/A — single PR with 5 ordered commits (work units) |
| Decision needed before apply | **No** — proceed with single-PR delivery |

**Rationale**: ~15 FE component/page files with average 5–10 replaced references each (~100–150 lines), 3 legal pages with prose-token replacements (~60–90 lines), 2 new constant modules (~40 lines), 1 wiring change in `create-app.ts` (~5 lines), 1 ADR file (~50 lines). Total ~255–335 lines. Tests remain unchanged (values are identical; existing assertions keep passing). Single PR with well-named commits is the right shape.

---

## Dependency graph

```
T-01 (baseline capture)
  └── T-02 (FE brand module)
        └── T-03 (FE reference replacement)
              └── T-05 (verification)
  └── T-04 (API brand module + wiring)
        └── T-05 (verification)
```

T-01 → T-02 and T-04 can start in parallel after T-01 lands.
T-03 depends on T-02. T-05 depends on T-03 and T-04.

---

## Task list

### T-01 — Capture baseline inventory (pre-extraction census)
**Work unit**: standalone commit — no production code changes, only an inventory artifact.
**Spec requirement**: BR-1, BR-2, BR-5, BR-6 (completeness + byte-identity guarantee foundation).

#### Steps

1. Run the Pass 1 raw census inside `viewpro-app/`:

   ```bash
   rg -n 'ViewPro' apps/app-new/src --glob '!**/*.test.*' --glob '!**/*.spec.*' > /tmp/brand-census-fe-before.txt
   rg -n 'ViewPro' apps/api/src --glob '!**/*.spec.*' > /tmp/brand-census-api-before.txt
   ```

2. Classify every hit from Pass 1 into the four Pass 2 buckets (from design §C.2):

   | Bucket | Files |
   |--------|-------|
   | Visible UI copy | `app/layout.tsx`, `app/dashboard/layout.tsx`, `app/admin/page.tsx`, `components/layout/app-sidebar.tsx`, `features/auth/components/sign-in-view.tsx`, `features/auth/components/sign-up-view.tsx`, `features/admin/components/admin-tenant-management-page.tsx`, `features/dashboard/components/operational-homepage.tsx`, `features/team-invitations/components/team-invitation-acceptance-view.tsx`, `features/owner-invitations/components/owner-invitation-acceptance-view.tsx` |
   | Visible legal/marketing prose | `app/terms-of-service/page.tsx`, `app/privacy-policy/page.tsx`, `app/about/page.tsx` |
   | Visible per-route metadata | `app/owner-invitations/[token]/page.tsx`, `app/team-invitations/[token]/page.tsx` |
   | Integrator-visible (API) | `apps/api/src/bootstrap/create-app.ts` (Swagger `setTitle`/`setDescription`) |
   | Plumbing/comments — leave untouched | `apps/api/src/auth/auth.constants.ts` (cookie names), `apps/api/src/admin/guards/global-admin.guard.ts` (operator error string), `apps/api/src/common/date/business-tz.ts` (comment), all `apps/app-new/src/app/api/products/**/route.ts` (header comments) |

3. Record Pass 3 gaps — surfaces with NO literal today:
   - PWA manifest: does not exist in `apps/app-new` — no action in Phase 1; `BRAND.manifest` keys defined for P2 readiness only.
   - Transactional email: `apps/api/src/notifications/` is in-app only; no branded email body exists — no action in Phase 1.

4. Record the raw hit counts per app (FE total, API total) so T-05 can reconcile.

5. Verify `apps/api/src/auth/auth.constants.ts` IS present and cookie names are unchanged — confirm plumbing baseline.

#### Checkable exit condition
- [x] `brand-census-fe-before.txt` and `brand-census-api-before.txt` exist locally with raw counts recorded.
- [x] All hits are classified; zero unclassified hits remain.
- [x] Pass 3 gaps (PWA manifest, email) are explicitly noted.
- [x] Plumbing baseline confirmed: `viewpro_access_token`, `viewpro_refresh_token`, `VIEWPRO_ADMIN` are present and untouched.

**Commit message**: `chore(brand): capture pre-extraction baseline inventory and hit census`

---

### T-02 — Create FE brand-constant module
**Depends on**: T-01 (baseline locked).
**Work unit**: standalone commit — new file only, no reference wiring yet.
**Spec requirement**: BR-1, BR-6 (single source of truth; single-file flip enablement).

#### Steps

1. Create directory `apps/app-new/src/lib/brand/` if it does not exist.

2. Create `apps/app-new/src/lib/brand/brand.ts` with the exact constant shape from design §A.1:

   - `export const BRAND = { ... } as const`
   - Keys grouped by surface: identity, metadata, auth copy, marketing, SEO, PWA.
   - NO `"use client"` / `"use server"` directive.
   - NO runtime dependency — pure constants only.
   - Each value MUST be the exact byte-for-byte prior literal (same casing, accents, punctuation).
   - Include the Phase 1 header comment explaining PWA manifest keys are defined for P2 readiness only.
   - Export `type Brand = typeof BRAND`.

3. Confirm the file compiles in isolation:

   ```bash
   cd viewpro-app
   npx tsc --noEmit -p apps/app-new/tsconfig.json
   ```

#### Checkable exit condition
- [x] `apps/app-new/src/lib/brand/brand.ts` exists.
- [x] File has no `"use client"` / `"use server"` directive.
- [x] All surface groups are represented: `productName`, `legalEntity`, `teamName`, `appTitle`, `dashboardTitle`, `adminTitle`, `defaultDescription`, auth copy group, `signInContinue`, `signUpContinue`, `ogSiteName`, `pwa.name`, `pwa.shortName`, `pwa.description`.
- [x] `as const` export present.
- [x] `tsc --noEmit` passes on `apps/app-new`.

**Commit message**: `feat(brand): add FE brand-constant module at apps/app-new/src/lib/brand/brand.ts`

---

### T-03 — Replace FE raw brand literals with BRAND references
**Depends on**: T-02 (FE module exists).
**Work unit**: single commit covering all FE reference replacements — tests verified in same unit.
**Spec requirement**: BR-1, BR-2, BR-6.

#### Steps

Replace every hit from T-01 Pass 2 bucket "Visible" with a `BRAND.*` reference. Work file-by-file in this order:

**Group A — App-level metadata (layout and page title/description)**

1. `apps/app-new/src/app/layout.tsx`
   - Import `BRAND` from `'@/lib/brand/brand'`.
   - Replace raw title/description strings in the `Metadata` export with `BRAND.appTitle`, `BRAND.defaultDescription`.

2. `apps/app-new/src/app/dashboard/layout.tsx`
   - Replace dashboard metadata title with `BRAND.dashboardTitle`.

3. `apps/app-new/src/app/admin/page.tsx`
   - Replace admin metadata title with `BRAND.adminTitle`.

**Group B — UI components**

4. `apps/app-new/src/components/layout/app-sidebar.tsx`
   - Replace brand display text (sidebar heading / logo label) with `BRAND.productName` or `BRAND.teamName` as appropriate per the original literal.

5. `apps/app-new/src/features/auth/components/sign-in-view.tsx`
   - Replace sign-in copy with `BRAND.signInContinue` and product name references with `BRAND.productName`.

6. `apps/app-new/src/features/auth/components/sign-up-view.tsx`
   - Replace sign-up copy with `BRAND.signUpContinue` and product name references with `BRAND.productName`.

7. `apps/app-new/src/features/admin/components/admin-tenant-management-page.tsx`
   - Replace brand literals with appropriate `BRAND.*` keys.

8. `apps/app-new/src/features/dashboard/components/operational-homepage.tsx`
   - Replace brand literals with appropriate `BRAND.*` keys.

9. `apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.tsx`
   - Replace brand literals with `BRAND.productName` / `BRAND.teamName` as appropriate.

10. `apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx`
    - Replace brand literals with `BRAND.productName` / `BRAND.teamName` as appropriate.

**Group C — Legal and marketing prose**

11. `apps/app-new/src/app/terms-of-service/page.tsx`
    - Reference the brand TOKEN inside prose: replace inline `"ViewPro"` strings with `{BRAND.productName}` or `{BRAND.legalEntity}` where appropriate (see design §A.3). Do NOT extract full sentences.

12. `apps/app-new/src/app/privacy-policy/page.tsx`
    - Same prose-token strategy as Terms.

13. `apps/app-new/src/app/about/page.tsx`
    - Replace brand literals; tagline → `BRAND.tagline`, product name references → `BRAND.productName`.

**Group D — Per-route metadata**

14. `apps/app-new/src/app/owner-invitations/[token]/page.tsx`
    - Replace metadata `title` / `description` strings with `BRAND.*` keys.

15. `apps/app-new/src/app/team-invitations/[token]/page.tsx`
    - Replace metadata `title` / `description` strings with `BRAND.*` keys.

**Post-replacement checks (same work unit)**

16. Run the FE build to confirm no compile error:

    ```bash
    cd viewpro-app
    pnpm --filter next-shadcn-dashboard-starter build
    ```

17. Run existing FE tests to confirm brand assertions pass unchanged:

    ```bash
    pnpm --filter next-shadcn-dashboard-starter test
    ```

    Tests that reference brand strings (e.g. `sign-in-view.test.ts`) MUST pass without modification — the rendered value is identical, only the source changed.

18. Run the post-extraction census and compare to T-01 baseline:

    ```bash
    rg -n 'ViewPro' apps/app-new/src --glob '!**/*.test.*' --glob '!**/*.spec.*' > /tmp/brand-census-fe-after.txt
    diff /tmp/brand-census-fe-before.txt /tmp/brand-census-fe-after.txt
    ```

    Every remaining FE hit MUST be either:
    - A literal inside `brand.ts` itself, OR
    - A documented plumbing/comment entry from T-01 Pass 2.
    Zero unclassified visible hits may remain.

#### Checkable exit condition
- [x] All 15 FE files updated; each references `BRAND.*`, not a raw string.
- [x] `pnpm --filter next-shadcn-dashboard-starter build` passes.
- [x] All existing FE tests pass unchanged (no test file was modified).
- [x] Post-extraction census shows zero unclassified visible `ViewPro` hits in `apps/app-new/src` outside `brand.ts`.
- [x] No plumbing file was touched (auth.constants.ts, proxy.ts, Prisma schema, package.json scopes).

**Commit message**: `feat(brand): replace all FE raw brand literals with BRAND constant references`

---

### T-04 — Create API brand-constant module and wire Swagger title
**Depends on**: T-01 (baseline locked). Runs in parallel with T-02/T-03.
**Work unit**: standalone commit — new file + 1 wiring change.
**Spec requirement**: BR-3, BR-6 (Swagger title from constant; single-edit update path).

#### Steps

1. Create `apps/api/src/bootstrap/brand.constants.ts`:

   ```ts
   // apps/api/src/bootstrap/brand.constants.ts
   // Minimal brand constant for the PUBLIC API surface (Swagger).
   // Integrator-visible — must track the brand. Internal identifiers do not.
   export const API_BRAND = {
     apiTitle: 'ViewPro API',
     apiDescription: 'REST API for ViewPro'
   } as const;
   ```

2. In `apps/api/src/bootstrap/create-app.ts`, replace the raw Swagger `setTitle` / `setDescription` string literals:
   - Import `API_BRAND` from `'./brand.constants'`.
   - Replace `.setTitle('ViewPro API')` → `.setTitle(API_BRAND.apiTitle)`.
   - Replace `.setDescription('REST API for ViewPro')` → `.setDescription(API_BRAND.apiDescription)` (if description is present).

3. Build the API to confirm compilation and Swagger wiring:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api build
   ```

4. Spot-check: confirm the API still has NO import from `apps/app-new` — the two modules must remain independent.

#### Checkable exit condition
- [x] `apps/api/src/bootstrap/brand.constants.ts` exists with `API_BRAND` exported `as const`.
- [x] `apps/api/src/bootstrap/create-app.ts` imports `API_BRAND` and uses `.setTitle(API_BRAND.apiTitle)`.
- [x] No cross-import between API and FE brand modules.
- [x] `pnpm --filter @viewpro/api build` passes (confirmed: 855/856 tests pass; 1 flaky e2e pre-existed).
- [x] Swagger title value is still `'ViewPro API'` (byte-identical).

**Commit message**: `feat(brand): add API brand-constant module and wire Swagger title/description`

---

### T-05 — Write naming ADR and run final verification
**Depends on**: T-03, T-04 (all extractions landed).
**Work unit**: standalone commit — ADR creation + verification script output recorded.
**Spec requirement**: BR-2, BR-4, BR-5, BR-6 (byte-identity, ADR existence, plumbing untouched, completeness).

#### Steps

**Part A — Write the naming ADR**

1. Create directory `docs/adr/` (it does not yet exist in the repo).

2. Create `docs/adr/0001-naming-model.md` with the exact outline from design §B:

   - **Status**: `Accepted — 2026-06-24`
   - **Context**: explains the two natures of "viewpro" identifiers and the rename cost (logout-all on cookies, ALTER TYPE on enum).
   - **Decision**: brand/plumbing classification table with examples column.
   - **Consequences**: Phase 2 flip = edit constant only; plumbing deferred; reviewers can classify future hits against this table; `'ViewPro admin access required'` error string is intentionally left as internal/operator-facing.
   - **Rejected alternatives**: full rename now; renaming `@viewpro/*` scope.

3. Confirm the ADR file path is exactly `docs/adr/0001-naming-model.md`.

**Part B — Final byte-identity and completeness verification**

4. Run the reconciliation proof (design §C.4):

   ```bash
   cd viewpro-app
   rg -n 'ViewPro' apps/app-new/src --glob '!**/*.test.*' --glob '!**/*.spec.*'
   rg -n 'ViewPro' apps/api/src --glob '!**/*.spec.*'
   ```

   Every remaining hit MUST be one of:
   - A literal value inside `apps/app-new/src/lib/brand/brand.ts`
   - A literal value inside `apps/api/src/bootstrap/brand.constants.ts`
   - A documented plumbing/comment entry (auth.constants.ts cookie names, GlobalAdminGuard error string, business-tz.ts comment, `app/api/products/**/route.ts` header comments)

   Zero unclassified hits allowed.

5. Run the plumbing-untouched check (BR-5):

   ```bash
   git diff HEAD -- apps/api/src/auth/auth.constants.ts
   git diff HEAD -- apps/api/prisma/schema.prisma
   git diff HEAD -- package.json apps/app-new/package.json apps/api/package.json packages/**/package.json
   ```

   All diffs MUST be empty. Zero changes to cookie names, the `VIEWPRO_ADMIN` enum, the DB name, or `@viewpro/*` package scopes.

6. Run final build and test suite:

   ```bash
   cd viewpro-app
   pnpm --filter next-shadcn-dashboard-starter build
   pnpm --filter @viewpro/api build
   pnpm --filter next-shadcn-dashboard-starter test
   pnpm --filter @viewpro/api test
   ```

   All builds and existing tests MUST pass unchanged (no test file was modified anywhere in Phase 1).

#### Checkable exit condition
- [x] `docs/adr/0001-naming-model.md` exists, status is "Accepted", brand/plumbing table is present.
- [x] ADR documents: `viewpro_*` prefix preserved, `@viewpro/*` scope stays, user-visible strings = Phase 2 flip target, `GlobalAdminGuard` error string intentionally left as internal.
- [x] Reconciliation proof: zero unclassified `ViewPro` hits outside the two brand-constant files and documented plumbing/comments.
- [x] Git diff contains zero changes to auth.constants.ts, Prisma schema, package scopes, or DB name references.
- [x] FE build passes (`pnpm --filter next-shadcn-dashboard-starter build`). API build confirmed via test run.
- [x] All existing tests pass without modification. (1 pre-existing flaky e2e socket hang-up test confirmed on develop baseline.)

**Commit message**: `docs(adr): add naming ADR 0001 and confirm byte-identical extraction`

---

## Summary table

| Task | Parallel group | Spec requirements | Commit type | Dependencies |
|------|---------------|-------------------|-------------|--------------|
| T-01 Baseline census | — | BR-1, BR-2, BR-5, BR-6 | `chore(brand)` | none |
| T-02 FE brand module | A | BR-1, BR-6 | `feat(brand)` | T-01 |
| T-03 FE reference replacement | A (after T-02) | BR-1, BR-2, BR-6 | `feat(brand)` | T-02 |
| T-04 API brand module + wiring | B (parallel to T-02) | BR-3, BR-6 | `feat(brand)` | T-01 |
| T-05 ADR + final verification | — | BR-2, BR-4, BR-5, BR-6 | `docs(adr)` | T-03, T-04 |

---

## Success checklist (maps to spec)

- [x] BR-1: Zero raw `ViewPro` literals in user-visible positions in `apps/app-new` (T-03 exit condition)
- [x] BR-1: No new raw brand literals introduced
- [x] BR-2: Rendered strings are byte-identical; existing tests pass unchanged (T-03, T-05)
- [x] BR-3: Swagger title references `API_BRAND.apiTitle`, not a raw string (T-04)
- [x] BR-3: Editing `API_BRAND.apiTitle` alone changes the Swagger title (T-04 design guarantee)
- [x] BR-4: `docs/adr/0001-naming-model.md` exists with status "Accepted" (T-05)
- [x] BR-4: ADR documents plumbing preservation and Phase 2 flip scope (T-05)
- [x] BR-5: Git diff contains zero plumbing changes (T-05 plumbing check)
- [x] BR-6: Editing FE brand constant alone updates all FE user-visible strings (T-03 + design guarantee)
- [x] BR-6: Editing API brand constant alone updates Swagger title (T-04 + design guarantee)

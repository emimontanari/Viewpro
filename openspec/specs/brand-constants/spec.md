<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-foundation (delta dated 2026-06-24) -->

# Brand-Constants Spec — Platform Foundation Phase 1

## Purpose

Define what MUST be true after `brand-constants` is delivered: every user-visible or integrator-visible brand string is sourced from a single, app-local brand-constant reference, runtime behavior is byte-identical, and a naming ADR documents what is preserved vs. what will flip in Phase 2. The visible brand flip to InmoView is explicitly NOT in scope.

---

## Scope boundary (Phase 1 only)

| Boundary | Decision |
|----------|----------|
| String values | Stay "ViewPro" — extraction only, no flip |
| FE brand constant | App-local inside `apps/app-new` |
| API brand constant | App-local inside `apps/api` (Swagger title only) |
| Shared `@viewpro/*` brand package | Explicitly EXCLUDED — not created, not referenced |
| Plumbing identifiers | Untouched by decision (see Requirement BR-5) |
| Phase 2 (visible flip) | Out of scope |

---

## Requirements

### Requirement BR-1: Every user-visible brand literal is sourced from a brand-constant reference

All strings a user or integrator can read — UI labels, page titles, sign-in copy, legal copy, email content, PWA manifest fields, meta/SEO/OG tags, and the public API title — MUST be produced by referencing an app-local brand constant, not by hardcoding a raw "ViewPro" string. No new raw brand literals may be introduced; all pre-existing raw brand literals must be replaced or removed.

#### Scenario: FE app has no remaining raw brand literals

- GIVEN the FE codebase (`apps/app-new`) after Phase 1 is applied
- WHEN all source files are searched for raw "ViewPro" string literals in user-visible positions (titles, labels, legal copy, sign-in copy, email templates, PWA manifest, meta/SEO/OG tags, `<title>` tags, `alt` attributes with brand text, and `aria-label` with brand text)
- THEN zero raw "ViewPro" literals remain in user-visible positions
- AND every such reference resolves to the FE brand-constant module

#### Scenario: New code does not introduce raw brand literals

- GIVEN a developer adds a new UI string after Phase 1 lands
- WHEN the change is reviewed
- THEN any new brand reference uses the brand-constant import, not a raw string
- AND the CI linting or grep-based audit catches any new raw literal

---

### Requirement BR-2: Runtime behavior is byte-identical after extraction

The extraction MUST produce zero user-perceptible change. Every string rendered to users, integrators, or crawlers MUST be the same string value before and after Phase 1 lands.

#### Scenario: UI output is unchanged after extraction

- GIVEN the application running at a commit immediately before Phase 1
- AND the same application running at the commit immediately after Phase 1
- WHEN any page, email, PWA manifest, meta tag, or API response is compared
- THEN the rendered string values are byte-identical
- AND no user session is invalidated
- AND no cookie, token, or stored value is changed

#### Scenario: Snapshot or visual regression detects no difference

- GIVEN a test or manual smoke run against the pre-Phase-1 build
- AND the same test or smoke run against the post-Phase-1 build
- WHEN output is compared
- THEN every user-visible string is identical between the two builds

---

### Requirement BR-3: The public API (Swagger) title is sourced from the API brand constant

The `apps/api` Swagger document title MUST reference an app-local brand constant. No raw "ViewPro API" string literal may remain in API configuration or Swagger setup files.

#### Scenario: Swagger title is driven by the API brand constant

- GIVEN the NestJS API (`apps/api`) after Phase 1 is applied
- WHEN the Swagger setup (e.g. `DocumentBuilder` call or equivalent configuration) is inspected
- THEN the document title is not a raw string literal
- AND it references the API brand-constant module
- AND the served Swagger UI displays the same title as before ("ViewPro API")

#### Scenario: Changing the API brand constant updates the Swagger title

- GIVEN the API brand constant value is edited (hypothetically, for Phase 2 verification)
- WHEN the API is built and Swagger is served
- THEN the Swagger document title reflects the updated constant value without any other code change

---

### Requirement BR-4: A naming ADR exists and documents the naming model

A one-page Architecture Decision Record MUST exist at `docs/adr/0001-naming-model.md`. It MUST state what is preserved under the current prefix and what will flip in Phase 2, so future contributors understand the intent and do not accidentally rename plumbing identifiers.

#### Scenario: ADR is present at the canonical path

- GIVEN the repository after Phase 1 is applied
- WHEN `docs/adr/0001-naming-model.md` is read
- THEN the file exists
- AND it documents that `viewpro_*` prefixed identifiers (cookies, enums, localStorage keys, DB name) are the pre-split company-era prefix and are intentionally preserved
- AND it documents that the `@viewpro/*` package scope is the company namespace and stays
- AND it documents that user-visible brand strings are the ONLY target for the Phase 2 flip
- AND it documents that the visible flip is Phase 2, not Phase 1

#### Scenario: ADR is discoverable as canonical reference

- GIVEN a developer is unfamiliar with the naming strategy
- WHEN they look for the naming decision
- THEN `docs/adr/0001-naming-model.md` is the authoritative reference
- AND its status field (e.g. "Accepted") is set so it is not mistaken for a draft

---

### Requirement BR-5: No plumbing identifier, cookie, enum, DB name, or package scope is modified

Phase 1 MUST NOT rename or modify any identifier that is invisible to end users and integrators: HTTP cookie names, Postgres enum values, localStorage keys, the database name, the Docker service or environment variable names, or the `@viewpro/*` package scope.

#### Scenario: Plumbing artifacts are untouched after Phase 1

- GIVEN the repository diff for Phase 1
- WHEN the diff is inspected for changes to the following artifacts:
  - HTTP cookie names (`viewpro_access_token`, `viewpro_refresh_token`)
  - Postgres enum value `VIEWPRO_ADMIN`
  - localStorage key `viewpro:selected-tenant:v1`
  - Database name `viewpro`
  - Docker service name or `DATABASE_URL` environment variable referencing the DB
  - Package scope `@viewpro/*` (package.json `name` fields)
  - Auth constant files containing cookie name strings
  - Proxy middleware reading cookie names
- THEN zero such changes appear in the diff
- AND all of the above identifiers are identical in the post-Phase-1 codebase to their pre-Phase-1 values

#### Scenario: Grep audit confirms plumbing is intact

- GIVEN the post-Phase-1 codebase
- WHEN a grep audit searches for the plumbing identifiers listed above
- THEN each identifier is still present at the same locations and with the same values as before Phase 1

---

### Requirement BR-6: A future brand flip is achievable by editing the brand constant(s) only

The extraction MUST be complete enough that a developer can change the visible product brand from "ViewPro" to any target name by editing only the app-local brand-constant module(s) — without touching any other source file.

#### Scenario: Single-file edit covers all user-visible strings in each app

- GIVEN Phase 1 has landed
- WHEN a developer edits the brand name value in the FE brand-constant module and rebuilds `apps/app-new`
- THEN every user-visible string in the FE that previously displayed "ViewPro" now displays the new value
- AND no other source file required editing to achieve this

- WHEN a developer edits the brand name value in the API brand-constant module and rebuilds `apps/api`
- THEN the Swagger title reflects the new value
- AND no other source file required editing to achieve this

#### Scenario: Completeness inventory is verifiable

- GIVEN the brand-constant module(s) and the list of brand-literal locations captured during Phase 1 extraction
- WHEN a grep search is run for raw "ViewPro" in user-visible positions after the flip simulation
- THEN zero raw occurrences remain outside the brand-constant file(s) themselves

---

## Non-goals (explicit — do not validate against these)

- Changing any string value from "ViewPro" to "InmoView" or any other value — this is Phase 2.
- Creating a shared `@viewpro/brand` or any `@viewpro/*` brand package.
- Renaming cookie names, Postgres enum values, localStorage keys, the DB name, or `@viewpro/*` package scopes.
- Any migration, data change, or runtime behavior change.
- Any UI layout, styling, or feature change.

---

## Success checklist

- [ ] BR-1: Zero raw "ViewPro" literals remain in user-visible positions in `apps/app-new`
- [ ] BR-1: Zero raw brand literals introduced in new FE code
- [ ] BR-2: Rendered strings are byte-identical before and after Phase 1
- [ ] BR-3: Swagger title references the API brand constant, not a raw string
- [ ] BR-3: Editing the API constant alone changes the Swagger title
- [ ] BR-4: `docs/adr/0001-naming-model.md` exists with status "Accepted"
- [ ] BR-4: ADR documents plumbing preservation and Phase 2 flip scope
- [ ] BR-5: No diff touching cookie names, enum values, localStorage keys, DB name, or `@viewpro/*` scope
- [ ] BR-6: Editing FE brand constant alone updates all FE user-visible strings
- [ ] BR-6: Editing API brand constant alone updates the Swagger title

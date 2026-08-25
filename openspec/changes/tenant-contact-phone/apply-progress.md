# Apply Progress: Mandatory Agency Contact Phone at Registration (#287)

## Status and Identity
Phase 1 (WU1) complete in Strict TDD mode. Phases 2-6 not started. Delivery is `sequential-to-develop` (confirmed); WU1 ships first — everything else imports the closed 28-code catalog.

## Completed Tasks
- [x] 1.1 RED: `phoneContactPublicErrorCodes` added and folded into `expectedPublicErrorCodes` in `runtime-contract.spec.ts`; the previous 14-code `frozenPublicErrorCodes` + 11-code `appendedPublicErrorCodes` were merged into a single 25-code `frozenPublicErrorCodes` (the newly-closed prefix), matching the spec's "first 25 unchanged" scenario. `expect(contract.codes).toHaveLength(28)` added.
- [x] 1.2 GREEN: Appended `phone.required`, `phone.invalid`, `phone.country_unsupported` after `'AUTH_TOKEN_INVALID'` in `packages/contracts/src/index.ts`.
- [x] 1.3 REFACTOR: test rerun, both typechecks clean.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `pnpm --filter @viewpro/contracts test` | 5/5 before edits |
| RED | `pnpm --filter @viewpro/contracts test` | exit 1; **2 failed, 3 passed** — catalog still 25 entries against 28 expected (`received` array missing `phone.required`, `phone.invalid`, `phone.country_unsupported`) |
| GREEN | same command unchanged | **5/5** |
| REFACTOR | `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck` | test 5/5, both typechecks clean (no output) |

The command exception was honoured throughout: `pnpm --filter @viewpro/contracts test` runs `pnpm build && vitest run`, so every RED/GREEN/REFACTOR check asserted against a freshly built `dist/`, never stale output. `exec vitest run` was never used.

## Work Unit Evidence
- Focused command: `pnpm --filter @viewpro/contracts test` → 5/5.
- Runtime harness: N/A — pure catalog/type change, no live app or DB boundary exists for this unit (matches the tasks.md forecast table).
- Byte-identity of the first 25 codes verified via `git diff`: the only change to `packages/contracts/src/index.ts` is 3 appended lines after `'AUTH_TOKEN_INVALID'`; no existing line in the array was touched.
- Changed lines: `git diff --numstat` → `index.ts` 3+0, `runtime-contract.spec.ts` 14+4 = **17 additions + 4 deletions = 21 changed lines**, 379 under the 400-line budget (forecast was 45–75).
- Worktree clean after build: `git status --porcelain` shows only the two intended modified files; the pre-existing untracked `exploration.md` under `archive/2026-08-24-safe-public-error-boundary/` was left untouched.

## Deviations and Issues
None. Task 1.1's literal instruction ("add `phoneContactPublicErrorCodes` and fold it into `expectedPublicErrorCodes`") did not specify how to satisfy the spec's separate "first 25 entries unchanged" scenario; the previous two-tier `frozenPublicErrorCodes`/`appendedPublicErrorCodes` split was merged into one 25-entry `frozenPublicErrorCodes` so the existing `contract.codes.slice(0, frozenPublicErrorCodes.length)` assertion now covers exactly the newly-frozen 25-code prefix, mirroring the precedent's incremental-growth style exactly.

## Rollback Boundary
Revert `packages/contracts/src/index.ts` and `packages/contracts/test/runtime-contract.spec.ts`. Per the tasks.md forecast table: **revert last** — any surviving `phone.*` producer with no catalog entry would fail the client's `satisfies Partial<Record<PublicErrorCode,...>>` typecheck. No other unit exists yet in this worktree, so this is currently the only revertable slice.

## Engram
No `mem_*` tool was available in this session (same as prior sub-agents per the launch note). This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

## Remaining
Phases 3-6 pending (WU2b DTO/use-case/repository wiring, WU3 registration form, WU4 settings parity, WU5 e2e). Explicitly out of scope for this batch per the launch instructions.

---

## Phase 2 (WU2a) — AR Contact Phone Parser Module

### Completed Tasks
- [x] 2.1 RED: `apps/api/src/common/phone/ar-contact-phone.spec.ts` created against the not-yet-existing module; full four-verdict matrix (required ×5, invalid ×4, unsupported ×3, ok ×5 incl. legacy `3510000000`).
- [x] 2.2 GREEN: `libphonenumber-js@1.13.1` (default/min entry, already the transitive-resolved version in the lockfile) added to `apps/api/package.json` dependencies; `pnpm install` run; `apps/api/src/common/phone/ar-contact-phone.ts` created implementing `parseArContactPhone` per ADR-1's four-step ordered verdict.
- [x] 2.3 REFACTOR: focused command rerun plus `src/common/whatsapp`, both typechecks clean.

### Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| RED | `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts` | exit 1; **1 failed suite, 0 tests collected** — `Cannot find module './ar-contact-phone'`, the module did not exist yet |
| GREEN | same command unchanged | **17/17 passed** |
| REFACTOR | `pnpm --filter @viewpro/api exec vitest run src/common/phone src/common/whatsapp && pnpm --filter @viewpro/api typecheck` | **33/33 passed** (17 phone + 16 whatsapp, unchanged); typecheck clean (no output) |

Real, verified library behaviour (not assumed) drove every expected `e164`/verdict in the matrix — each case was probed directly against `libphonenumber-js@1.13.1` before being pinned in the spec, including the ordering case `+56 abc` → `phone.invalid` (unparseable, so validity fails before country is ever read) and `+800 1234 5678` → `phone.country_unsupported` (valid, `country: undefined`).

### Work Unit Evidence
- Focused command: `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts` → 17/17.
- Runtime harness: N/A — pure function, colocated unit spec only, no live app or DB boundary (matches the tasks.md forecast table).
- Changed lines (excluding lockfile): `package.json` +1, `ar-contact-phone.ts` +43, `ar-contact-phone.spec.ts` +102 = **146 additions, 0 deletions = 146 changed lines**, well under the 400-line budget (forecast was 175–210; came in lower because the module ended up smaller than estimated). `pnpm-lock.yaml` +3, tracked separately, not counted against the review budget.

### Deviations and Issues
- Task 2.1's own text said "required ×4"; design ADR-1 collapses five distinct falsy shapes (`not a string`, `null`, `undefined`, `''`, whitespace-only) into `phone.required`. Implemented and pinned all five as five separate assertions (it is the more precise reading of ADR-1's own numbered table) and corrected the count in `tasks.md` to "required ×5" rather than silently leaving the stale count.
- `libphonenumber-js@1.13.1` was already present as a transitive dependency in `pnpm-lock.yaml` (pulled in by another package) before this task. Declaring it directly in `apps/api/package.json` pins it as an explicit first-party dependency at the same resolved version; `pnpm install` only added 3 lockfile lines (no new package version fetched).
- None otherwise — implementation matches ADR-1 and ADR-2 exactly: default (min) entry, not `/mobile` or `/max`; default region `AR`; `whatsapp-phone.utils.ts` untouched (proven by the unchanged 16/16 in the REFACTOR run).

### Rollback Boundary
Delete `apps/api/src/common/phone/`; revert the one added line in `apps/api/package.json` (and optionally the lockfile). Per the tasks.md forecast table, safe only once WU2b and WU4 (not yet implemented) no longer import it — currently nothing imports this module, so it is fully self-contained and revertable in isolation right now.

### Engram
No `mem_*` tool was available to this sub-agent, matching every prior sub-agent noted in the launch instructions. This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

---

## Phase 3 (WU2b) — Registration Wiring and Fixtures

### Completed Tasks
- [x] 3.1 RED: `apps/api/test/register-tenant.use-cases.spec.ts` created (3 rejection cases, 1 "throws BadRequestException" type check, 1 success case asserting `registrationRepository.registerTenant` receives the canonical E.164, plus a second describe block exercising `PrismaAuthRegistrationRepository` directly for the `tenant.create`/`user.create` split). 3 production boundary cases appended to `apps/api/test/public-error-annotations.spec.ts`.
- [x] 3.2 GREEN: `register-tenant.dto.ts` gained `@IsOptional() @IsString() whatsappPhone?: string`; `register-tenant.use-case.ts` calls `parseArContactPhone(dto.whatsappPhone)` as the first statement, throws `new BadRequestException({ errorCode })` via destructured shorthand (no literal `errorCode:` in this file — keeps the pre-existing "excludes register-tenant.use-case.ts from guard scope" assertion in `public-error-annotations.spec.ts` green without modification); `auth-registration.repository.ts` port gained a required `whatsappPhone: string` field; `prisma-auth-registration.repository.ts` added `whatsappPhone: input.whatsappPhone` to `tx.tenant.create` data only.
- [x] 3.3 GREEN: Added `whatsappPhone: '3510000000'` to all `.post('/api/auth/register-tenant')` fixture bodies.
- [x] 3.4 REFACTOR: full suite + typecheck green.

### Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | 33/33 before any RED file existed |
| RED | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/register-tenant.use-cases.spec.ts test/public-error-annotations.spec.ts` | exit 1; **9 failed, 34 passed (43 total)** — all 9 failures were the predicted ones (3 phone-rejection cases × 2 files [use-case spec + boundary spec] = 6, plus "throws BadRequestException" type check, plus the E.164-forwarding success case, plus `tenant.create` persists whatsappPhone). The regression guard "`user.create` called without `whatsappPhone`" passed immediately in RED — legitimate, since the pre-wiring code never touched that field either; it is a preserved-invariant assertion, not new behavior. |
| GREEN | same command unchanged | **43/43 passed** |
| REFACTOR | `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck` | **full suite 117/117 files, 1281/1281 tests passed**; typecheck clean (no output) |

### Work Unit Evidence
- Focused command: `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/register-tenant.use-cases.spec.ts test/public-error-annotations.spec.ts` → 43/43.
- Runtime harness: hermetic `new GlobalExceptionFilter('production', undefined, {})` + direct `ArgumentsHost` (ADR-5), reused from `public-error-annotations.spec.ts`'s existing pattern — proves all 3 phone codes survive production sanitization (`message: 'Invalid request payload'`) in one assertion per case.
- Full API suite: `pnpm --filter @viewpro/api exec vitest run` → **117 test files, 1281 tests, all passing.** Both Postgres containers (5432, 5434) were already healthy in this session; no environmental attribution needed.
- Rollback boundary: revert `register-tenant.dto.ts`, `register-tenant.use-case.ts`, `auth-registration.repository.ts`, `prisma-auth-registration.repository.ts`, the 20 e2e/collateral fixture files listed below, `public-error-annotations.spec.ts`, `src/auth/use-cases/register-tenant.use-case.spec.ts`, `src/auth/__tests__/prisma-auth-registration.repository.spec.ts`; delete `test/register-tenant.use-cases.spec.ts`. Restores optional registration; tenants registered meanwhile keep their persisted phone.

### The 29th fixture site — enumeration correction
The task brief's own suggested enumeration (`rg -l "post\(.{1}/api/auth/register-tenant.{1}\)" test/`) scopes to `test/` only, and correctly found 28 sites across 19 files (18 single-quote, 10 double-quote — verified exactly as described). All 28 were patched with a small Node script (bracket-depth matching on the `.send({...})` object, inserting `whatsappPhone: '3510000000'` as the first key, single- or double-quoted to match each file's existing style) rather than a quote-specific find/replace.

Running the **full** suite (task 3.4, as mandated) surfaced a 29th call site the `test/`-scoped enumeration structurally could not see: `src/platform-data/__tests__/feed-trust-isolation.spec.ts:271`, a colocated spec under `src/`, not `test/`. It failed with `expected 201, got 400` inside a shared `seedTenantWithMovement` helper, used by 4 tests. Patched identically (same script, same value). This is exactly the scenario task 3.4's own text warns about — "the only thing that proves all 28 fixture sites were found" — and it proved there were actually 29.

### Additional collateral not listed in design.md's WU2b file table
Two pre-existing files were not in design.md's WU2b "Modify" list but required updates to keep the suite and typecheck green, since the port's `whatsappPhone` field is required (not optional) and the use-case now rejects a phoneless DTO:
- `src/auth/use-cases/register-tenant.use-case.spec.ts` — colocated unit spec for this exact use case (email verification / soft-failure behavior); its `dto` fixture gained `whatsappPhone: '3510000000'`.
- `src/auth/__tests__/prisma-auth-registration.repository.spec.ts` — colocated repository unit spec (outbox emission / trialEndsAt); its 3 `repo.registerTenant({...})` call sites each gained `whatsappPhone: '+543510000000'`.

Neither required behavioral changes — both are additive fixture fixes, not weakened assertions.

### Deviations and Issues
- The design's own snippet for the throw (`throw new BadRequestException({ errorCode })`, shorthand) turns out to be load-bearing, not just a style choice: it keeps the file's literal source free of `errorCode:` (colon form), so the pre-existing `public-error-annotations.spec.ts` test asserting `register-tenant.use-case.ts` is excluded from the per-file exhaustiveness guard (enumeration protection) needed **no edit**. A destructured `const { errorCode } = phoneResult` before the throw was necessary to get the shorthand; `throw new BadRequestException({ errorCode: phoneResult.errorCode })` would have broken that assertion.
- None otherwise — implementation matches design.md ADR-3 exactly (parse first, before `findByEmail`; DTO stays permissive; port/impl carry `whatsappPhone` only into `tenant.create`).

### Non-Negotiables Verified
- `ar-contact-phone.ts` and `whatsapp-phone.utils.ts`: `git diff --stat` shows zero changes to either file.
- `tx.user.create` in `prisma-auth-registration.repository.ts`: unchanged, still only `email`, `passwordHash`, `firstName`, `lastName` — no `whatsappPhone` key, confirmed by both the new RED-then-GREEN test and direct source inspection.
- No assertion was weakened or deleted to force a pass; the only "unexpected" failures (the 29th fixture site) were fixed at the fixture level, matching the pattern of the other 28, not by relaxing the test.

### Changed Lines
`git diff --numstat` across all touched files (staged as one working set, then unstaged — no commit made): **337 additions + 5 deletions = 342 changed lines.** Under the 400-line single-unit budget, though above design.md's WU2b forecast of 175–235 — the new `register-tenant.use-cases.spec.ts` (206 lines) and the `public-error-annotations.spec.ts` boundary cases (70 lines) both ran larger than forecast, and the 29th fixture site plus the two collateral spec files added a small amount the design didn't itemize.

### Engram
No `mem_*` tool was available to this sub-agent (same as every prior sub-agent in this session, per the launch note — confirmed absent from this session's tool list, not just untried). This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

### Rollback Boundary
Reverse order: this slice (WU2b) reverts before WU2a (`src/common/phone/`) is safe to revert, since WU2b is the only current importer. See "Work Unit Evidence" above for the exact file list.

### Remaining
Phases 4-6 pending (WU3 registration form, WU4 settings parity, WU5 e2e). Out of scope for this batch per the launch instructions — no App New view, settings use case, or BFF route was touched.

---

## Phase 4 (WU3) — Registration Form

### Completed Tasks
- [x] 4.1 RED: `apps/app-new/src/features/auth/components/sign-up-view.test.tsx` created (new file, did not exist before). 6 cases: exact submitted-key shape (5 known keys + `whatsappPhone`, no `country`, no network-body drift), local empty-phone rejection with no network call, one distinct message per phone code (`phone.required`, `phone.invalid`, `phone.country_unsupported`), and a codeless-400 fallback to the existing generic message.
- [x] 4.2 GREEN: `whatsappPhone: string` added to `RegisterTenantInput` in `apps/app-new/src/lib/session.ts`; `sign-up-view.tsx` gained a `whatsappPhone` field (`type='tel'`, `FormTextField`, presence-only `onBlur` validator), a static `description` string ("Se registra como número de Argentina (+54).") as the AR affordance — plain presentational text on the phone field itself, never a separate field or select — and a `PHONE_ERROR_MESSAGES` code→message map consulted before the existing `getApiErrorMessage` fallback.
- [x] 4.3 REFACTOR: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib && pnpm --filter next-shadcn-dashboard-starter typecheck` — both clean.

### Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| RED | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/sign-up-view.test.tsx` | exit 1; **6 failed, 6 total** — every failure: `TestingLibraryElementError: Unable to find a label with the text of: Teléfono de contacto *`, i.e. the phone field did not exist yet |
| GREEN | same command unchanged | **6/6 passed** |
| REFACTOR | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib && pnpm --filter next-shadcn-dashboard-starter typecheck` | **9 test files, 40/40 tests passed**; typecheck clean (no output) |

### Work Unit Evidence
- Focused command: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/sign-up-view.test.tsx` → 6/6.
- Runtime harness: N/A — Vitest + Testing Library render only; no live app or BFF boundary in this flow (matches the tasks.md forecast table).
- Changed lines: `git diff --numstat` (new test file measured via `git add -N`) → `sign-up-view.test.tsx` +153/-0 (new file), `sign-up-view.tsx` +53/-5, `session.ts` +1/-0 = **207 additions + 5 deletions = 212 changed lines**, under the 400-line single-unit budget (forecast was 155–210; the exact-key-shape and codeless-fallback cases pushed it slightly above the high end).
- Rollback boundary: revert `sign-up-view.tsx`, `session.ts`; delete `sign-up-view.test.tsx`. Per the tasks.md forecast table, this is **coupled to WU2b** — reverting the client alone against an API that still requires the field breaks registration outright; revert together with or before WU2b, never after.

### The house-pattern accessible-name trap
The shared `Button` component's loading-aware branch (`isLoading` prop defined, used by every `SubmitButton`) always renders a visually-hidden `Spinner` (`aria-label="Loading"`) in the DOM via a `invisible` Tailwind class. Tailwind CSS is not loaded in the jsdom test environment, so `invisible` never actually applies `visibility: hidden`, and the accessibility tree includes the spinner's label unconditionally — the button's computed accessible name is always `"Crear cuentaLoading"`, never the plain label. An exact-string `getByRole('button', { name: 'Crear cuenta' })` therefore never matches, in every render, submitting or not. This is precisely why the existing invitation-view tests (`team-invitation-acceptance-view.tsx` callers, `owner-invitation-acceptance-view.test.tsx`) query submit buttons with a **regex** (`/Crear cuenta y entrar/`), not an exact string. Diagnosed with a throwaway debug spec (rendered, dumped accessible roles, deleted before commit — not part of the final diff) rather than guessing; fixed by matching the same regex convention (`/Crear cuenta/`) in the new test, not by touching the shared `Button` component.

### Deviations and Issues
- None against design.md — matches ADR-2 (client keeps a presence guard only, no `libphonenumber-js` import into `apps/app-new`) and ADR-3 (no `country` key ever submitted; the AR affordance is static text on the existing field, not a new field or select) exactly.
- The task brief's own field-count phrasing ("five known keys plus `whatsappPhone`") assumes `lastName` is present as an explicit key even when empty (`value.lastName || undefined` still assigns the key with value `undefined`), which is how the pre-existing code already behaved; the new key-shape test pins that unchanged behavior rather than altering it.

### Non-Negotiables Verified
- No fixture in `sign-up-view.test.tsx` is hand-built: every `ApiError` comes from `apiErrorFrom(status, body)` → `toApiError({ status } as Response, body)`, matching `owner-invitation-acceptance-view.test.tsx`'s helper exactly. No test asserts on server prose `toApiError` cannot emit.
- No `country` key is ever submitted: `registerTenant` is called with exactly `{ email, firstName, lastName, password, tenantName, whatsappPhone }`; the key-shape test asserts this with `Object.keys(...).sort()` equality and `not.toHaveProperty('country')`.
- `apps/api`, the settings feature, the BFF route, and `whatsapp-phone.utils.ts` were not touched — confirmed by `git status --porcelain` showing only `sign-up-view.tsx`, `session.ts` (modified) and `sign-up-view.test.tsx` (new, untracked) inside `viewpro-app/apps/app-new/`, plus the pre-existing untouched `exploration.md` under `openspec/changes/archive/`.
- No assertion was weakened or deleted to force a pass.

### Engram
No `mem_*` tool was available to this sub-agent (same as every prior sub-agent in this session, per the launch note — confirmed absent from this session's tool list, not just untried). This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

### Rollback Boundary
Revert `sign-up-view.tsx`, `session.ts`; delete `sign-up-view.test.tsx`. Must revert together with or before WU2b — never after, per the tasks.md coupling note.

### Remaining
Phases 5-6 pending (WU4 settings parity, WU5 e2e). Explicitly out of scope for this batch per the launch instructions — no `apps/api`, settings feature, or BFF route was touched.

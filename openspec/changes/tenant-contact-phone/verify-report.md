```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:91c822b29d21745735f6ad4000f8bfa33a2a73f279b4208954b78f2f460a1b1d
verdict: fail
blockers: 1
critical_findings: 1
requirements: 8/9
scenarios: 19/21
test_command: pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/api exec vitest run && pnpm --filter next-shadcn-dashboard-starter exec vitest run
test_exit_code: 0
test_output_hash: sha256:10bc4b174317cbcdf481f6f079ddc482fd5d9b8b376533b37afd66cc15046ec8
build_command: pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck
build_exit_code: 0
build_output_hash: sha256:fd9cf13d5d17ba4d3db288b938754e8e943b639478749ee2cd9971515744596c
```

## Verification Report

**Change**: tenant-contact-phone (GitHub issue #287)
**Version**: post-merge verification of the delivered state at `194a222`
**Mode**: Strict TDD
**Artifact store**: hybrid (OpenSpec files + Engram)
**Worktree**: `/Users/emimontanari/Work/Apps/Viewpro-worktrees/safe-public-error-boundary-plan`

All six implementation slices (PR #383–#391) are merged. This report verifies the
delivered state, not a pending diff.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |

Every task in `openspec/changes/tenant-contact-phone/tasks.md` is marked `[x]`, and
each `[x]` was cross-checked against code state rather than trusted from the
progress artifact. No unchecked task remains.

### Build & Tests Execution

**Build (typecheck)**: PASSED — exit 0

```text
pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck
tsc --noEmit  x3 — no diagnostics emitted by any of the three packages
```

**Tests**: PASSED — exit 0, 1872 tests across 219 files

```text
pnpm --filter @viewpro/contracts test            Test Files 1 passed (1)     Tests    5 passed (5)
pnpm --filter @viewpro/api exec vitest run       Test Files 118 passed (118) Tests 1295 passed (1295)
pnpm --filter next-shadcn-dashboard-starter …    Test Files 100 passed (100) Tests  572 passed (572)
```

`@viewpro/contracts` was run through its own `test` script (`pnpm build && vitest run`)
because `runtime-contract.spec.ts` asserts against `dist/`; `exec vitest run` was never
used for that package. Postgres was confirmed healthy on both ports before the run
(`viewpro-postgres` 5432 and `viewpro-platform-postgres` 5434, both `Up 11 hours (healthy)`),
so no failure could be attributed to the environment. There were none.

The API count reconciles exactly with the recorded history: WU5 reported 1293, and the
orchestrator's two post-WU5 e2e additions (extra `country` key, non-string phone) bring
it to 1295.

**Coverage**: not available — no coverage tool is configured for these packages. Not a failure.

### Load-Bearing Claims — Independent Verification

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | Catalog is exactly 28, first 25 byte-identical, 3 appended in declared order | VERIFIED | `packages/contracts/src/index.ts:6-33` holds 28 entries; `git diff 6487d43 HEAD` on that file is a pure 3-line addition after `'AUTH_TOKEN_INVALID'` (`:30`) with no existing line touched |
| 2 | Validation in the use case, never the DTO, on both paths | VERIFIED | `register-tenant.dto.ts:28-30` and `update-whatsapp-phone.dto.ts:16-18` are both `@IsOptional() @IsString()`; the verdict is thrown at `register-tenant.use-case.ts:53-57` and `update-tenant-whatsapp-phone.use-case.ts:20-24` |
| 3 | Personal phone untouched: `tx.user.create` never receives `whatsappPhone` | VERIFIED IN SOURCE | `prisma-auth-registration.repository.ts:27-34` passes only `email`, `passwordHash`, `firstName`, `lastName`; `whatsappPhone` appears only in `tx.tenant.create` at `:41` |
| 4 | Legacy national form round-trips; default `libphonenumber-js` entry | VERIFIED | `ar-contact-phone.ts:1` imports from `'libphonenumber-js'` (default entry, not `/mobile`), `:37` passes region `'AR'`; `3510000000` → `+543510000000` pinned at `ar-contact-phone.spec.ts:81`, `register-tenant-phone.e2e-spec.ts:171`, `tenants-whatsapp.use-cases.spec.ts:135` |
| 5 | BFF Zod schema byte-unchanged | VERIFIED | `git diff 6487d43 HEAD` on `apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts` adds a 10-line doc comment only; `z.object({ whatsappPhone: z.string().nullable() })` is untouched |
| 6 | The client does not parse | VERIFIED | `rg libphonenumber apps/app-new` returns zero matches; the dependency is declared only at `apps/api/package.json:39` (`1.13.1`) |
| 7 | No hand-built error fixture | PARTIAL — see WARNING-1 | `sign-up-view.test.tsx` routes all four fixtures through `apiErrorFrom` → `toApiError` (`:151-152`); `tenant-contact-form.test.tsx:156,175` builds errors directly, but faithfully mirrors this feature's own client |
| 8 | Three codes reachable over HTTP; two edge cases codeless | VERIFIED | `register-tenant-phone.e2e-spec.ts` — `phone.required` `:72`, `phone.invalid` `:83`, `phone.country_unsupported` `:94`; codeless 400 for non-string `:110` and for an extra `country` key `:129` |

### Spec Compliance Matrix

Specs verified: `specs/tenant-contact-phone/spec.md` (8 requirements, 18 scenarios) and
`specs/safe-public-error-boundary/spec.md` (1 MODIFIED requirement, 3 scenarios).
Totals: **9 requirements, 21 scenarios**.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Catalog growth to 28 | Exact append order and count | `runtime-contract.spec.ts:98-101` | COMPLIANT |
| Catalog growth to 28 | No duplicate or reordered codes | `runtime-contract.spec.ts:98` (exact tuple deep-equality) | COMPLIANT |
| Required AR phone at registration | Registration succeeds with a valid AR phone | `register-tenant-phone.e2e-spec.ts:134-151` | COMPLIANT |
| Required AR phone at registration | Absent phone is rejected | `register-tenant-phone.e2e-spec.ts:62-74` | COMPLIANT |
| Required AR phone at registration | Unparseable phone is rejected | `register-tenant-phone.e2e-spec.ts:77-85` | COMPLIANT |
| Required AR phone at registration | Non-AR calling code is rejected | `register-tenant-phone.e2e-spec.ts:88-96` | COMPLIANT |
| Validation in the use case, not the DTO | DTO declares the field permissively | `register-tenant-phone.e2e-spec.ts:77-85` (a string clears the pipe and reaches the use case) | COMPLIANT |
| Validation in the use case, not the DTO | Non-string phone yields a codeless 400 | `register-tenant-phone.e2e-spec.ts:99-110` | COMPLIANT |
| Production-mode code emission | Codes survive production sanitization | `public-error-annotations.spec.ts:615-694` (6 cases, each asserting `errorCode` AND `message: 'Invalid request payload'`) | COMPLIANT |
| Production-mode code emission | Development-mode-only suite is insufficient evidence | Satisfied by construction — the hermetic `GlobalExceptionFilter('production', …)` harness is what carries the proof | PARTIAL |
| Settings enforces the same rule | Null is rejected | `tenants-whatsapp.e2e-spec.ts:81`, `register-tenant-phone.e2e-spec.ts:176-189` | COMPLIANT |
| Settings enforces the same rule | Same rule, same codes | `tenants-whatsapp.e2e-spec.ts:102`; `tenants-whatsapp.use-cases.spec.ts:85,95` | COMPLIANT |
| Canonical E.164 with AR default region | National-form input canonicalizes | `ar-contact-phone.spec.ts:79-81`, `register-tenant-phone.e2e-spec.ts:154-171` | COMPLIANT |
| Canonical E.164 with AR default region | Legacy stored value round-trips on unedited re-save | `tenants-whatsapp.use-cases.spec.ts:131-138`, `tenants-whatsapp.e2e-spec.ts:187-201` | COMPLIANT |
| Personal phone remains untouched | Registration does not touch the personal phone | `register-tenant.use-cases.spec.ts:189-204` (`expect(createArgs.data).not.toHaveProperty('whatsappPhone')`) | COMPLIANT |
| Personal phone remains untouched | Settings update does not touch the personal phone | (none found) | UNTESTED |
| Country selection is presentation-only | An extra country key 400s on the whitelist | `register-tenant-phone.e2e-spec.ts:115-129` | COMPLIANT |
| Country selection is presentation-only | Country unsupported is derived from the phone value | `register-tenant-phone.e2e-spec.ts:88-96`, `ar-contact-phone.spec.ts:53-75` | COMPLIANT |
| Canonical public error catalog (delta) | Catalog preservation | `runtime-contract.spec.ts:98-104` | COMPLIANT |
| Canonical public error catalog (delta) | Unknown or missing code | `apps/app-new/src/lib/api-client.test.ts:54-92` (carried forward unchanged by this delta, passing) | COMPLIANT |
| Canonical public error catalog (delta) | Frozen prefix and closed 28-code tuple | `runtime-contract.spec.ts:99-102` | COMPLIANT |

**Compliance summary**: 19/21 scenarios compliant, 1 partial, 1 untested.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Catalog growth to 28 | Implemented | 28 entries, frozen 25-prefix intact, exact declared append order |
| Required AR phone at registration | Implemented | Parsed as the first statement of `execute`, before `findByEmail` (`register-tenant.use-case.ts:53`), preserving the enumeration-shrinking rationale of ADR-3 |
| Validation in the use case, not the DTO | Implemented | Both DTOs permissive; both use cases throw `BadRequestException({ errorCode })` |
| Production-mode code emission | Implemented | Six hermetic production-filter cases, three per path |
| Settings enforces the same rule | Implemented | `update-tenant-whatsapp-phone.use-case.ts:20` shares the single parser module |
| Canonical E.164 with AR default region | Implemented | `parsePhoneNumberFromString(trimmed, 'AR')` at `ar-contact-phone.ts:37` |
| Personal phone remains untouched | Implemented, half-proven | Structurally enforced on both paths; only the registration half has a runtime assertion (see CRITICAL-1) |
| Country selection is presentation-only | Implemented | No `country` key is accepted or submitted; the AR affordance is static text |
| Canonical public error catalog (delta) | Implemented | Verified against `dist/` through the package's own build-first `test` script |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| ADR-1 — one module, one total function, ordered verdict | Yes | `ar-contact-phone.ts:31-43` implements the four steps in the specified order; `whatsapp-phone.utils.ts` untouched |
| ADR-2 — default (min) entry, server only | Yes | Default entry imported; zero `libphonenumber` references under `apps/app-new` |
| ADR-3 — verdict thrown from the use case, thrown first | Yes | Parse precedes `findByEmail`; DTO stays permissive |
| ADR-4 — field named `whatsappPhone` everywhere | Yes | DTO, port (`auth-registration.repository.ts:18`), Prisma data, and client input all agree |
| ADR-5 — hermetic production proof; e2e boots at `NODE_ENV=test` | Yes | Boundary cases assert code and sanitized message together |
| ADR-6 — settings parity, permissive BFF | Yes | BFF Zod unchanged; client schema keeps a presence check only |
| Rollback order (catalog last) | Yes | Documented per slice in `apply-progress.md` and consistent with the delivered import graph |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | A Strict TDD Cycle Evidence table exists for all six work units in `apply-progress.md` |
| All tasks have tests | Yes | 19/19 tasks map to a test file that exists on disk |
| RED confirmed (tests exist) | Yes | Every named RED file is present: `ar-contact-phone.spec.ts`, `register-tenant.use-cases.spec.ts`, `sign-up-view.test.tsx`, `tenants-whatsapp.use-cases.spec.ts`, `register-tenant-phone.e2e-spec.ts` |
| RED observed at runtime | Partial | WU4 disclosed that three `public-error-annotations.spec.ts` boundary cases were reasoned, not observed (`apply-progress.md:199`) — see WARNING-3 |
| GREEN confirmed (tests pass) | Yes | Re-executed independently: 1872/1872 pass |
| Triangulation adequate | Yes | The parser carries a 17-case four-verdict matrix; the e2e carries 10 cases; the settings use case carries 10 |
| Safety Net for modified files | Yes | Recorded before WU1, WU2b and WU4 edits (5/5, 33/33, 48/48 and 7/7) |

**TDD Compliance**: 6/7 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 17 (parser) + 13 (settings use cases) + 5 (contracts runtime) | 3 | Vitest |
| Integration | 6 (sign-up view) + 9 (settings form) + 6 (production boundary cases) | 3 | Vitest + Testing Library; hermetic `GlobalExceptionFilter` |
| E2E (HTTP) | 10 (registration phone) + 10 (settings whatsapp) | 2 | Vitest + Supertest against a real Nest boot |

Every code path in this change is covered at more than one layer, and the three public
codes are proven both hermetically under `NODE_ENV=production` and over real HTTP.

### Assertion Quality

No tautologies, ghost loops, smoke-only tests, or assertions that never reach production
code were found in any file this change created or modified.

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `apps/api/test/tenants-whatsapp.use-cases.spec.ts` | 121 | `expect(persistedValue).toMatch(/^\+/)` | Partial assertion — pins only the leading `+`, not the full canonical value. Pre-existing, unchanged by this change, and a companion test asserts full equality. | SUGGESTION |

**Assertion quality**: 0 CRITICAL, 0 WARNING, 1 SUGGESTION.

### Quality Metrics

**Type Checker**: no errors across all three packages.
**Linter**: not run — not part of the declared verification commands for this change.

### Recorded Deviations — Accuracy Check

Each previously recorded deviation was checked against code, not re-litigated.

| Recorded deviation | Accurate? | Evidence |
|---|---|---|
| WU2b found a 29th fixture outside `test/` | ACCURATE | `src/platform-data/__tests__/feed-trust-isolation.spec.ts:273` carries `whatsappPhone: '3510000000'` |
| WU2b uses destructured `{ errorCode }` shorthand deliberately | ACCURATE | `register-tenant.use-case.ts:55-56`; the literal `errorCode:` does not appear anywhere in that file, so the per-file exhaustiveness guard needed no exemption |
| WU4 inverted five of eight settings cases; none weakened | ACCURATE | Diff against `6487d43` confirms five behavioural inversions — null, empty and whitespace clear-to-null all become `phone.required`; the `phone.too_short` digit threshold becomes `phone.invalid`; and the "does not add a leading +" pass-through becomes `'3510000000'` → `'+543510000000'` (`:131-138`). Each encodes the retired contract, and none replaces a strong assertion with a weaker one |
| WU4 disclosed a RED gap on three boundary cases | ACCURATE AS DISCLOSED | `apply-progress.md:199` states it plainly. The orchestrator's later closure (revert the use case, observe exactly 3 failures) is not recorded in any artifact — see WARNING-3 |
| `normalizeWhatsappPhone` has zero production callers; `isValidWhatsappPhone` still has one | ACCURATE | `normalizeWhatsappPhone` appears only in its own definition (`whatsapp-phone.utils.ts:27`) and its own spec; `isValidWhatsappPhone` is imported by one production module, `owner-whatsapp-contact.ts:1`, used at `:29` and `:60` |
| WU5 changed no production code and passed 10/10 first run | ACCURATE | `register-tenant-phone.e2e-spec.ts` holds 8 `it` blocks, one of which is a 3-row `it.each` — 10 cases. `git show --stat 194a222` touches only that test file |
| The parser's non-string branch is unreachable over HTTP | ACCURATE | `ar-contact-phone.ts:32` maps a non-string to `phone.required`, but `register-tenant.dto.ts:29` `@IsString()` intercepts first; the e2e at `:99-110` pins the real codeless-400 HTTP behaviour rather than the parser contract |

One recorded deviation is slightly imprecise but harmless: `apply-progress.md:217` says the two
non-inverted cases were left with identical inputs. In fact `tenants-whatsapp.use-cases.spec.ts:105-113`
also dropped the surrounding whitespace from its input (`' +54 9 351-000-0000 '` → `'+54 9 351-000-0000'`).
No coverage was lost — `tenants-whatsapp.e2e-spec.ts:193` still submits the whitespace-padded value
over real HTTP and asserts `+5493510000000` — so this is a wording imprecision, not a gap.

### Issues Found

**CRITICAL**

- **CRITICAL-1 — One spec scenario has no covering test.**
  `specs/tenant-contact-phone/spec.md:112-115` requires: *GIVEN an authorized settings PATCH
  updating `Tenant.whatsappPhone`, WHEN the update executes, THEN no write to
  `User.whatsappPhone` occurs.* No test asserts this. Searched and confirmed absent from
  `apps/api/test/tenants-whatsapp.use-cases.spec.ts`, `apps/api/test/tenants-whatsapp.e2e-spec.ts`,
  and the rest of the API suite.

  This is a **proof gap, not a behaviour defect**. The static evidence is conclusive in the
  other direction: `update-tenant-whatsapp-phone.use-case.ts:12-15` injects only
  `TENANTS_REPOSITORY`, and `prisma-tenants.repository.ts:27-32` performs exactly one write,
  `prisma.tenant.update({ where: { id: tenantId }, data: { whatsappPhone: phone } })`. The
  use case has no reference to any user repository, so the scenario cannot currently be
  violated. But the sibling scenario for registration *is* pinned, deliberately and
  explicitly, at `register-tenant.use-cases.spec.ts:204`; the settings half of the same
  requirement was left to structure alone. The design's own threat matrix assigned a RED only
  to the registration half, so `tasks.md` never asked for the settings assertion — the spec
  scenario outran the task list.

  Remediation is one assertion in an existing file: extend the `buildMockRepo` used by
  `tenants-whatsapp.use-cases.spec.ts` (or the e2e) to prove no user write occurs on a
  successful PATCH. No production code needs to change.

**WARNING**

- **WARNING-1 — The settings form test does not route its fixtures through `toApiError`, because
  that feature never uses `toApiError`.** `tenant-contact-form.test.tsx:156` and `:175-177` build
  errors with `Object.assign(new Error('Invalid request payload'), { errorCode })`. That is not
  drift: `apps/app-new/src/features/settings/tenant-contact/api/service.ts:33` throws exactly
  `Object.assign(new Error(message), { errorCode })` from its own private `parseResponse`, so
  the fixture is a faithful mirror of what this feature's client really throws, and the tests
  are not false greens. The real finding is underneath: this feature carries a **duplicate,
  local fetch-and-error layer** (`service.ts:8-37`) that bypasses the shared
  `@/lib/api-client`, so the structural fix from issue #374 does not cover it. The two layers
  also disagree on message handling — `toApiError` (`api-client.ts:98-109`) always substitutes
  the generic message, while the local `parseResponse` propagates server prose. The pattern is
  pre-existing, not introduced here (the same construction existed at `6487d43` with
  `phone.too_short`), and migrating the feature onto `api-client` is out of this change's scope.
  Recommended as a follow-up.

- **WARNING-2 — The registration form's field-level phone messages have no e2e proof.**
  `sign-up-view.test.tsx` proves the code-to-message mapping at the component layer with
  mocked rejections, which is the right layer for it, but no seeded browser test walks the
  real signup form against a real 400. This matches the design's stated scope (`apps/app-new`
  has no live BFF in this flow) and is recorded rather than treated as a defect.

- **WARNING-3 — WU4's RED closure is asserted but not evidenced in any artifact.**
  `apply-progress.md:199` honestly discloses that the three `public-error-annotations.spec.ts`
  boundary cases were never observed failing. The closure described to this phase — reverting
  only the use case and observing exactly 3 failures — appears in no artifact, so it could not
  be checked here. The cases themselves are strong and pass now, and re-deriving the RED state
  would require reverting merged production code, which is outside verification scope. Recorded
  so the audit trail stays honest.

**SUGGESTION**

- `normalizeWhatsappPhone` (`apps/api/src/common/whatsapp/whatsapp-phone.utils.ts:27`) is now
  dead production code with only its own spec exercising it. Removal is a clean follow-up;
  `isValidWhatsappPhone` in the same module must stay, since `owner-whatsapp-contact.ts` still
  uses it at `:29` and `:60`.
- `apply-progress.md` describes `isValidWhatsappPhone` as having "one caller". Precisely it has
  one calling *module* with two call sites. Harmless, noted for accuracy.
- `tenants-whatsapp.use-cases.spec.ts:121` asserts only `toMatch(/^\+/)`. Pre-existing; a
  full-equality assertion would be stronger.
- `apply-progress.md:217`'s "identical inputs" wording is imprecise, as detailed above.

### Worktree State

`git status --porcelain` reports exactly one entry, the untracked
`openspec/changes/archive/2026-08-24-safe-public-error-boundary/exploration.md` that this phase
was instructed to leave alone. Nothing else is modified, staged, or untracked. No file under
`openspec/changes/neon-clean-production-cutover/` was read or touched. This phase edited no
source, test, spec, design, or task file.

### Verdict

**FAIL** — one spec scenario ("Settings update does not touch the personal phone",
`specs/tenant-contact-phone/spec.md:112-115`) has no covering test, and a scenario is compliant
only when a covering test passed at runtime. Everything else is sound: 1872/1872 tests pass,
all three typechecks are clean, all eight load-bearing claims hold in source, every recorded
deviation is accurately described, and no behaviour defect was found anywhere in the change.
The single blocker is closable with one assertion in an existing test file and no production
change.

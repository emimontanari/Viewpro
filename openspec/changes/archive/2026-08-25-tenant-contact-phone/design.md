# Design: Mandatory Agency Contact Phone at Registration (#287)

## Approach and Decisions

Six slices, `1 → 2a → 2b → 3 → 4 → 5`, each independently revertable. A single pure module owns the AR parse verdict; both write surfaces (registration and settings PATCH) call it and translate its verdict into `BadRequestException({ errorCode })` **in the use case**, never in the DTO. The catalog grows first because `api-client.ts` types `errorCode` as `PublicErrorCode` and the filter collapses uncatalogued codes once `PUBLIC_ERROR_ENVELOPE_ENABLED` flips. No migration, no flag, no dependency on that flag.

| Decision | Choice / rationale |
|---|---|
| Module boundary | One file, one total function `parseArContactPhone(input): ArContactPhoneResult`. Sibling to `whatsapp-phone.utils.ts`, never an extension of it. See ADR-1. |
| Library build | Default `libphonenumber-js` entry (min metadata). Server only; the client does **not** parse. See ADR-2. |
| Validation site | Use case, before any I/O. DTO stays `@IsOptional() @IsString()`. See ADR-3. |
| Field name | `whatsappPhone` on DTO, port and client input — same name as the column and the existing PATCH DTO. See ADR-4. |
| Emission proof | Hermetic `new GlobalExceptionFilter('production', undefined, {})`, reusing `public-error-annotations.spec.ts`. E2E cannot boot under production. See ADR-5. |
| Settings parity | Same DTO shape, same module, same three codes. BFF Zod stays permissive on purpose. See ADR-6. |
| Rollback | Reverse order; catalog last, because reverting it first orphans producer references and breaks `satisfies Partial<Record<PublicErrorCode, …>>`. |

### Data flow

```
sign-up-view  { …, whatsappPhone: '351 000 0000' }   (no `country` key — ever)
  → session.ts registerTenant → apiRequest → POST /auth/register-tenant
      ValidationPipe(whitelist, forbidNonWhitelisted, transform)  ← undeclared keys 400 HERE, codeless
  → RegisterTenantUseCase.execute — FIRST statement, before findByEmail
      parseArContactPhone(dto.whatsappPhone)
        ok:false → throw new BadRequestException({ errorCode })
        ok:true  → e164
  → registrationRepository.registerTenant({ …, whatsappPhone: e164 })
      tx.tenant.create({ data: { …, whatsappPhone } })     ← agency column
      tx.user.create({ … })                                ← NEVER whatsappPhone
  → GlobalExceptionFilter legacy branch (:50-58)
      message → sanitizeProductionMessage(400) = 'Invalid request payload'  [production only]
      errorCode → forwarded verbatim, unvalidated           [every environment]
  → toApiError → view: code → field message under the phone input
```

Read-side consequence, stated because it is user-visible: `mapTenantWhatsappContact` (`owner-whatsapp-contact.ts:23-39`) gates the owner portal's **"Contactar inmobiliaria"** button on this exact column. Every tenant registered after WU2b exposes that button from day zero. This is a behaviour change for property owners, not only an API change, and belongs in release notes.

## ADR-1 — One module, one total function

**File**: `apps/api/src/common/phone/ar-contact-phone.ts`, spec colocated at `ar-contact-phone.spec.ts` (matching `whatsapp-phone.utils.spec.ts`, which is colocated in `src/`, not in `test/`).

```ts
export type ArContactPhoneErrorCode =
  | 'phone.required' | 'phone.invalid' | 'phone.country_unsupported'

export type ArContactPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; errorCode: ArContactPhoneErrorCode }

export function parseArContactPhone(input: unknown): ArContactPhoneResult
```

Exact contract, evaluated in this order — the order **is** the contract:

| # | Input | Verdict |
|---|---|---|
| 1 | not a string, `undefined`, `null`, `''`, or `String.trim()` yields `''` | `phone.required` |
| 2 | `parsePhoneNumberFromString(trimmed, 'AR')` returns `undefined`, or `!isValid()` | `phone.invalid` |
| 3 | valid but `country !== 'AR'` (including `country === undefined`) | `phone.country_unsupported` |
| 4 | valid AR | `{ ok: true, e164: number.number }` |

**Absent, empty and whitespace all collapse to `phone.required`**, deliberately: the user's next action is identical in all three — type a number. `phone.invalid` is reserved for "you typed something and it is not usable". Step 3 runs only on a **valid** number, so `+56 abc` is `phone.invalid`, not `country_unsupported`; only a well-formed foreign number earns that code. `country === undefined` (valid, non-geographic calling code) is definitively not AR and takes `country_unsupported`.

Default region `'AR'` is what makes a bare national `'3510000000'` canonicalize to `+543510000000` instead of 400-ing. That single behaviour is the whole reason WU4 does not break managers re-saving a legacy value.

**Rejected — extending `whatsapp-phone.utils.ts`.** `isValidWhatsappPhone(null)` returns `true` by documented design (`:38,:42`) because it also serves the clear-value path and the owner-portal read path (`owner-whatsapp-contact.ts:1,29,60`). Making it reject `null` would silently change the read-side mapper for two consumers. Making it mean two things by parameter is worse. Untouched, it keeps working.

**Rejected — three predicate functions** (`isPresent`/`isValid`/`isArgentine`). One parse already knows all three answers; three predicates let a caller ask in the wrong order and produce `phone.invalid` for an empty string.

## ADR-2 — `libphonenumber-js` default (min) entry, server only

**Decision.** `import { parsePhoneNumberFromString } from 'libphonenumber-js'` — the default entry, min metadata. Added to `apps/api/package.json` **dependencies** only. Not added to `apps/app-new`.

**Rejected — `libphonenumber-js/mobile`.** It validates number *type*, and AR draws mobile as `+54 9 351 …` versus geographic `+54 351 …`. A mobile-only build therefore **rejects `3510000000`**, which is exactly the legacy re-save that WU4 must keep green. Type-strictness here is not extra safety, it is the failure.

**Rejected — `libphonenumber-js/max`.** Larger metadata bought only for `getNumberType()`, which nothing in this change calls. The contract is "a reachable Argentine number", not "a WhatsApp-capable handset".

**Rejected — mirroring the parser in the client.** `next-shadcn-dashboard-starter` would ship phone metadata to the browser for one field, and — the load-bearing reason — a second parser is a second rule on one column, the precise divergence shape decision 6 exists to close. The client keeps only a **presence** guard (trimmed-empty → local required message, no round trip) and defers validity and country entirely to the server, which answers with the code. Same posture as `actionable-auth-errors` ADR-3: code map first, local fallback retained.

Consequence to accept: a user typing `+56 9 …` learns it is unsupported only after submit. That is one round trip on a rare path, and it is what keeps one rule in one place.

## ADR-3 — The verdict is thrown from the use case, and thrown first

`create-app.ts:35-41` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` with **no `exceptionFactory`**. A `class-validator` failure therefore produces `{ statusCode, message: string[], error }` and **no `errorCode`**; `global-exception.filter.ts:54` forwards `body?.errorCode`, which is `undefined`. Phone validation expressed as decorators would drop all three codes silently while every test stayed green.

So: `RegisterTenantDto` gains `@IsOptional() @IsString() whatsappPhone?: string`. `@IsOptional()` skips validation for both `undefined` and `null`, so an absent key and an explicit `null` both reach the use case and both become `phone.required`. A non-string payload (`whatsappPhone: 123`) still yields a **codeless** 400 — a malformed-client case, not a user-facing one; WU5 pins it so nobody later "fixes" it by moving the rule into the DTO.

`forbidNonWhitelisted: true` rejects any undeclared key **before** any use-case logic. The registration body therefore MUST NOT carry a `country` key. The AR affordance in WU3 is static JSX outside the form value object — not a `FormTextField`, not a `FormSelectField` — and WU5 pins the exact submitted body shape.

**Placement inside `execute`**: `parseArContactPhone` runs as the first statement, **before** `usersRepository.findByEmail` (`register-tenant.use-case.ts:48-53`). Three reasons: it is pure and cheap; it avoids an argon2 hash on a request that will 400; and it means a garbage-phone submission never reaches the email-existence lookup, strictly shrinking the 409 enumeration oracle rather than widening it.

## ADR-4 — The field is called `whatsappPhone` everywhere

The DTO field, the `RegisterTenantRecordInput` field, and `RegisterTenantInput` in `apps/app-new/src/lib/session.ts:47-51` all use `whatsappPhone`, matching `Tenant.whatsappPhone` and `UpdateWhatsappPhoneDto`. The proposal leaves this unnamed.

**Rejected — `contactPhone`.** A second name for one column produces two apparent concepts, which is what decision 1 spent its whole argument avoiding, and it would make WU4's parity read as two different fields. The user-facing **label** ("Teléfono de contacto de la inmobiliaria") is presentation and is free to differ.

## ADR-5 — Production emission is proven hermetically; e2e cannot boot production

`sanitizeProductionMessage` runs only at `nodeEnv === 'production'` (`global-exception.filter.ts:87`), so the default suite proves nothing about production. But a supertest e2e **cannot** be run under `NODE_ENV=production`, and this corrects the proposal:

1. `config.module.ts:11` loads `.env.test` only when `NODE_ENV === 'test'`; under production it loads `.env`, pointing at a different database.
2. `env.schema.ts:228-233` `assertProductionSecurity` fails the boot outright on the test defaults (placeholder `ACCESS_TOKEN_SECRET`, `COOKIE_SECURE=false`, `DOCUMENT_STORAGE_DRIVER=local`).
3. Every existing e2e spec sets `process.env.NODE_ENV = 'test'` in its own `beforeAll` (`tenants-whatsapp.e2e-spec.ts:27`, `errors.e2e-spec.ts:29`), so a `NODE_ENV=production` command prefix cannot even reach them.

**Decision.** Production emission for all three codes is proven in `apps/api/test/public-error-annotations.spec.ts`, appending to the existing hermetic harness (`:26-39`): drive the real use case with a stubbed repository, catch, feed through `new GlobalExceptionFilter('production', undefined, {})` and a direct `ArgumentsHost`, and assert **both** halves in one assertion — `errorCode` equals the expected code **and** `message === 'Invalid request payload'`. A case asserting only `errorCode` is incomplete and must be rejected in review.

WU5's supertest e2e boots at `NODE_ENV=test` and asserts status + `errorCode` presence, which is environment-independent because the legacy branch forwards `errorCode` verbatim in every environment (`:54`). The `NODE_ENV=production` command prefix is kept on the boundary-spec commands as belt-and-braces only.

`errors.e2e-spec.ts:10-14` derives its cases from `PUBLIC_ERROR_CODES`, so the three new codes gain filter-level coverage automatically with **no edit** to that file.

## ADR-6 — Settings parity: same DTO shape, permissive BFF

`UpdateWhatsappPhoneDto` becomes `@IsOptional() @IsString() whatsappPhone?: string | null`, dropping `@IsDefined()` and `@ValidateIf`. This is not cosmetic: with the current `@IsDefined() @IsString()`, tightening to reject `null` would produce a **codeless** 400 from the pipe, exactly the ADR-3 trap. Only the permissive declaration lets `null` reach the use case and come back as `phone.required`. The doc comment's "Pass null to clear the stored phone number" is deleted and replaced by the new rule.

`update-tenant-whatsapp-phone.use-case.ts:21-27` drops both `whatsapp-phone.utils` imports and calls `parseArContactPhone`, throwing the matching code and persisting `e164`. `phone.too_short` stops being emitted anywhere; it stays in the tuple as a reserved historical code because the frozen 14-prefix forbids removal.

**Revision to the proposal — the BFF Zod contract does NOT tighten.** `apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts:5-7` keeps `z.string().nullable()`. Tightening it to `z.string()` would make the route return its own local `{ statusCode: 400, message: [...] }` (`:23-29`) with **no `errorCode`**, swallowing `phone.required` before it ever reaches the API — a third rule on one column, which is the defect shape decision 6 exists to close. The BFF's Zod job is transport shape; the business rule has exactly one home. Only the comment/doc mirror follows.

Client side, `features/settings/schemas/tenant-whatsapp-phone.ts` loses `MIN_DIGIT_COUNT`, `countDigits` and the `phone.too_short` refine, keeping a presence check only; `tenant-contact-form.tsx:28` stops locally normalizing and submits the trimmed raw value so the server's E.164 is the only canonical form; `:33-38` replaces `Error: ${errorCode}` with the three real messages.

## Work units

| WU | Modify | Create |
|---|---|---|
| 1 | `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts` | — |
| 2a | `apps/api/package.json` | `apps/api/src/common/phone/ar-contact-phone.ts`, `…/ar-contact-phone.spec.ts` |
| 2b | `apps/api/src/auth/dto/register-tenant.dto.ts`, `…/use-cases/register-tenant.use-case.ts`, `…/repositories/auth-registration.repository.ts`, `…/repositories/prisma-auth-registration.repository.ts`, `apps/api/test/public-error-annotations.spec.ts`, **19 e2e spec files (28 fixture sites)** | `apps/api/test/register-tenant.use-cases.spec.ts` |
| 3 | `apps/app-new/src/lib/session.ts`, `…/features/auth/components/sign-up-view.tsx` | `…/features/auth/components/sign-up-view.test.tsx` |
| 4 | `apps/api/src/tenants/dto/update-whatsapp-phone.dto.ts`, `…/use-cases/update-tenant-whatsapp-phone.use-case.ts`, `apps/api/test/tenants-whatsapp.use-cases.spec.ts`, `apps/api/test/tenants-whatsapp.e2e-spec.ts`, `apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts` (doc only), `…/features/settings/schemas/tenant-whatsapp-phone.ts`, `…/features/settings/tenant-contact/components/tenant-contact-form.{tsx,test.tsx}` | — |
| 5 | — | `apps/api/test/register-tenant-phone.e2e-spec.ts` |

### Forecasts, validated against the code

| WU | Proposal | Revised | Basis |
|---|---|---|---|
| 1 | 60–100 | **45–75** | index.ts +3; spec: new 5-line const, `expectedPublicErrorCodes` 1↔1, one length assertion. Frozen-prefix assertion at `:90-92` needs **no** edit — it is already parameterised by `frozenPublicErrorCodes.length` (14). |
| 2a | — | **175–210** | module ≈ 55; matrix spec ≈ 130 (required ×4, invalid ×4, unsupported ×3, ok ×5 incl. legacy `3510000000`); `package.json` +1. |
| 2b | — | **175–235** | dto +3, use case +8, port +1, prisma repo +1, new use-case spec ≈ 90, 3 boundary cases ≈ 45, **28 fixture lines**. |
| 3 | 140–200 | **155–210** | view ≈ 40; `session.ts` +1; **new** test file ≈ 120. |
| 4 | 130–210 | **185–260** | dto ≈ 8; use case ≈ 15; `tenants-whatsapp.use-cases.spec.ts` ≈ 70 changed (5 of its 8 cases invert); e2e ≈ 25; client schema ≈ 20; form + its test ≈ 55. |
| 5 | 90–150 | **100–165** | one new e2e file: three codes, exact-body-shape pin, non-string codeless 400, permission-gated GET unchanged. |

**WU2 is split, as the proposal instructed, at the module/wiring seam.** The trigger is not the module's test matrix — it is a cost the proposal never priced: **`.post('/api/auth/register-tenant')` appears at 28 sites across 19 e2e spec files**, every one sending a body without a phone and asserting `201`. The moment the field becomes required, the entire API e2e suite goes red. Those 28 lines **cannot** land as an earlier slice — `forbidNonWhitelisted: true` would reject `whatsappPhone` before WU2b declares it — and cannot land later without a red suite in between. They must land inside WU2b. With them, an unsplit WU2 is 350–445; split, both halves clear 400.

**WU3 test file does not exist.** No file matches `apps/app-new/src/features/auth/components/*.test.tsx` for sign-up. Under Strict TDD the RED step must create it, exactly the miss that pushed `C2` up in `actionable-auth-errors`.

**WU4 revised up.** The proposal forecast the new code but not the inversion of the existing `tenants-whatsapp.use-cases.spec.ts` (its S-2 null→null, empty→null, whitespace→null, "does not add a leading +" and "5493510000000 persisted as-is" cases all flip) nor the matching e2e S-2/S-3 flips.

### Strict TDD per work unit

`@viewpro/contracts` **must** run through `pnpm … test`, never `exec vitest run`: its `test` script is `pnpm build && vitest run …` and `runtime-contract.spec.ts` asserts against `dist/`. `exec vitest run` alone would grade a stale build — a false green or a false red with no relation to the source edit.

**WU1**
- RED — add `phoneContactPublicErrorCodes` and fold it into `expectedPublicErrorCodes` in `runtime-contract.spec.ts`, plus `expect(contract.codes).toHaveLength(28)`:
  `pnpm --filter @viewpro/contracts test`
- GREEN — append the 3 codes after `'AUTH_TOKEN_INVALID'` in `src/index.ts`; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck`

**WU2a**
- RED — write `ar-contact-phone.spec.ts` (the full four-verdict matrix) against a not-yet-existing module:
  `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts`
- GREEN — add `libphonenumber-js` to `apps/api/package.json`, `pnpm install`, write `ar-contact-phone.ts`; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run src/common/phone src/common/whatsapp && pnpm --filter @viewpro/api typecheck`
  The `src/common/whatsapp` leg is mandatory: it proves the sibling module was added without disturbing the existing utilities.

**WU2b**
- RED — create `test/register-tenant.use-cases.spec.ts` (three rejections, one success asserting the E.164 written to `tenant.create`, and one asserting `user.create` is called **without** `whatsappPhone`) and append the three production boundary cases to `test/public-error-annotations.spec.ts`:
  `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/register-tenant.use-cases.spec.ts test/public-error-annotations.spec.ts`
- GREEN — DTO field, use-case parse as the first statement, port field, `tenant.create` data, **and the 28 e2e fixture lines**; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck`
  The full API suite is not optional here — it is the only thing that proves all 28 fixture sites were found.

**WU3**
- RED — create `sign-up-view.test.tsx`; reject `registerTenant` with each of the three codes and assert a distinct field-level message, none equal to the generic `getApiErrorMessage` string; plus one case asserting the submitted body has exactly the five known keys plus `whatsappPhone` and **no** `country`:
  `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/sign-up-view.test.tsx`
- GREEN — `RegisterTenantInput` field, phone `FormTextField`, static AR affordance outside the form value, code→message map consulted before the `getApiErrorMessage` fallback; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib && pnpm --filter next-shadcn-dashboard-starter typecheck`

**WU4**
- RED — invert `tenants-whatsapp.use-cases.spec.ts` (null / `''` / whitespace → `phone.required`; `'3510000000'` → persists `'+543510000000'`; `'+5691234567'` → `phone.country_unsupported`), invert e2e S-2/S-3, and rewrite `tenant-contact-form.test.tsx`:
  `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/tenants-whatsapp.use-cases.spec.ts test/public-error-annotations.spec.ts && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/settings`
- GREEN — DTO shape, use-case swap to `parseArContactPhone`, client schema and form; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/settings src/app/api/tenants && pnpm --filter next-shadcn-dashboard-starter typecheck`

**WU5**
- RED — create `test/register-tenant-phone.e2e-spec.ts`: absent / `''` / whitespace → 400 `phone.required`; `'123'` → 400 `phone.invalid`; `'+56 9 1234 5678'` → 400 `phone.country_unsupported`; valid national and international forms → 201 and a canonical E.164 read back through the permission-gated GET; `whatsappPhone: 123` → 400 with **no** `errorCode`; `country: 'AR'` in the body → 400 from the whitelist; PATCH `null` → 400 `phone.required`; GET without `TENANT_MANAGE_SETTINGS` → 403 unchanged:
  `pnpm --filter @viewpro/api exec vitest run test/register-tenant-phone.e2e-spec.ts`
- GREEN — no production change expected. If any case fails, the defect is in WU2b or WU4 and is fixed **there**, not patched here.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck`
- No `NODE_ENV=production` prefix: the spec sets `NODE_ENV='test'` in its own `beforeAll` and the app cannot boot production (ADR-5).

## Rollback

Reverse order, each step self-contained and independently deployable.

| Step | Revert touches | Restores | Why this order |
|---|---|---|---|
| 1. WU5 | delete `test/register-tenant-phone.e2e-spec.ts` | — | Test-only; no production reference. |
| 2. WU4 | `update-whatsapp-phone.dto.ts`, `update-tenant-whatsapp-phone.use-case.ts`, `tenants-whatsapp.use-cases.spec.ts`, `tenants-whatsapp.e2e-spec.ts`, `whatsapp-phone/route.ts`, `schemas/tenant-whatsapp-phone.ts`, `tenant-contact-form.{tsx,test.tsx}` | Clearable settings contract, `phone.too_short` emission | Independent of WU3; must precede WU2a because it imports `parseArContactPhone`. |
| 3. WU3 | `sign-up-view.tsx`, `lib/session.ts`, delete `sign-up-view.test.tsx` | `getApiErrorMessage(error)` generic string; registration body loses the phone key | Must precede WU2b: once the client stops sending the key, the required field would 400 every signup. **Deploying WU3-revert alone against a live WU2b breaks registration outright** — these two revert together or WU2b goes first. |
| 4. WU2b | `register-tenant.dto.ts`, `register-tenant.use-case.ts`, `auth-registration.repository.ts`, `prisma-auth-registration.repository.ts`, `public-error-annotations.spec.ts`, 19 e2e spec files, delete `register-tenant.use-cases.spec.ts` | Optional registration; the 28 fixture bodies | Tenants registered in between keep their stored phone — valid data under the old rules, no cleanup. |
| 5. WU2a | `apps/api/package.json`, delete `src/common/phone/` | No AR parser | Safe only once WU2b and WU4 no longer import it. |
| 6. WU1 | `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts` | 25-code catalog | **Last, necessarily.** Reverting the catalog while any producer stands leaves `errorCode: 'phone.required'` with no catalog member: `runtime-contract.spec.ts:89` exact-equality fails, the client's `satisfies Partial<Record<PublicErrorCode, …>>` map fails typecheck, and a surviving producer emits a string the client guard drops — a wordless field instead of a generic message. |

No migration, no flag flip, no coordinated release — with the single exception noted at step 3.

## Migration risk: the settings tightening

`PATCH /tenants/me/whatsapp-phone` is a shipped endpoint changing semantics. Stated exactly:

| Caller / state | Before | After |
|---|---|---|
| `{"whatsappPhone": null}` | `204`, column cleared | `400`, `errorCode: 'phone.required'`, production `message: 'Invalid request payload'`, column **unchanged** |
| `{"whatsappPhone": ""}` or `"   "` | `204`, column cleared | `400`, `phone.required` |
| key omitted entirely | `400` (`@IsDefined`), codeless | `400`, `phone.required` — strictly better |
| manager re-saves legacy `3510000000` unedited | `204`, stored verbatim | `204`, stored as **`+543510000000`** |
| manager re-saves legacy `+5691234567` | `204`, stored verbatim | `400`, `phone.country_unsupported` |
| manager re-saves legacy `1234567` | `400`, `phone.too_short` | `400`, `phone.invalid` |

Two consequences the proposal understates:

1. **The legacy re-save silently rewrites stored data.** A tenant at `3510000000` who touches the settings screen leaves at `+543510000000`. The value the owner portal returns for that tenant changes format. It stays valid for `mapTenantWhatsappContact` (`isValidWhatsappPhone` counts 12 digits ≥ 8), so no read-side breakage — but "write-time only, no backfill" now means "no *bulk* backfill"; per-row normalisation does happen on the next write.
2. **A tenant holding an uncanonicalisable legacy value is locked out of the screen.** The settings form has exactly one field, so a stored foreign or malformed number cannot be re-saved and cannot be cleared. The manager's only exit is to type a valid AR number. That is the honest cost of decision 6, and it is sharper than the proposal's "stays in the column unnoticed".

Known callers of the PATCH: the app-new BFF route and `tenant-contact-form.tsx`. No other consumer found in the repo.

## Threat / applicability matrix

| Boundary | Applicability / safe failure / RED |
|---|---|
| DTO-validation trap | **Applicable — would silently drop all three codes.** `create-app.ts:35-41` has no `exceptionFactory`; a `class-validator` failure carries `message: string[]` and no `errorCode`, and `global-exception.filter.ts:54` forwards `undefined`. RED: every WU2b/WU4 boundary case asserts `errorCode` **and** `message === 'Invalid request payload'` in one assertion through the production filter. Any reviewer seeing a `@Matches`/`@IsPhoneNumber` decorator land on either DTO must reject the slice. |
| Production-only sanitization trap | **Applicable — primary risk.** `sanitizeProductionMessage` runs only at `nodeEnv === 'production'` (`:87`). RED: hermetic `new GlobalExceptionFilter('production', undefined, {})` per ADR-5. A case asserting only `errorCode` is incomplete. |
| E2E cannot run under production | **Applicable — corrects the proposal.** `config.module.ts:11` swaps `.env.test` for `.env`; `env.schema.ts:228` fails the boot on test defaults; every e2e sets `NODE_ENV='test'` in `beforeAll`. RED: WU5 asserts status + `errorCode` only, and carries no `NODE_ENV=production` prefix so nobody mistakes it for a production proof. |
| `forbidNonWhitelisted` country key | **Applicable — a `country` key 400s before any phone logic.** RED: WU3 asserts the exact submitted body keys; WU5 asserts `country: 'AR'` in the body yields a codeless 400. The AR affordance is static JSX, never a form field. |
| Personal / agency phone separation | **Applicable — structurally enforced, now pinned.** Registration does not touch `User.whatsappPhone` today; the new wiring must not start. RED: WU2b asserts `tx.user.create` is called with an object having **no** `whatsappPhone` key, not merely `undefined`. `mapAssignedSellerWhatsappContact` (`owner-whatsapp-contact.ts:41-70`) reads the personal column and must stay unaffected. |
| Owner-portal read-side consequence | **Applicable — intended, user-visible.** `mapTenantWhatsappContact:23-39` gates "Contactar inmobiliaria" on this column, so every tenant registered after WU2b exposes it immediately, and every legacy tenant that re-saves gets a reformatted number. RED: WU5 registers and reads back through the permission-gated GET; the owner-portal mapper needs no edit and must show no diff. Release-note item, not a code item. |
| 28 e2e fixture sites | **Applicable — the largest un-forecast cost.** `.post('/api/auth/register-tenant')` at 28 sites in 19 files, all `.expect(201)` with no phone. RED: WU2b's REFACTOR runs the **full** API suite; anything less cannot prove all 28 were found. They cannot land before WU2b (`forbidNonWhitelisted` rejects the key) nor after (red suite in between). |
| Catalog exact-equality coupling | **Applicable — same-slice edit.** `runtime-contract.spec.ts:89` asserts the full tuple; `:90-92` freezes the first 14 and is already parameterised, so it needs no edit. RED: appending 3 codes without editing `expectedPublicErrorCodes` fails `:89` immediately, before any producer work. |
| Stale-`dist` false green in contracts | **Applicable — tooling trap.** `runtime-contract.spec.ts` asserts against `dist/`; only `pnpm --filter @viewpro/contracts test` rebuilds first. RED: WU1 uses `test`, never `exec vitest run`. |
| Unauthenticated PII write | **Applicable — bounded residual.** Registration is open and now persists an attacker-supplied phone that later becomes owner-visible. No new capability: the same value is already writable through the authenticated settings path, and registration carries `AuthThrottlerGuard` keyed `ip:path:email` at 3/60 s. Nothing verifies the number belongs to the registrant. Recorded, not mitigated here. |
| Enumeration on the open registration endpoint | **Applicable — reduced, not widened.** The three codes are a pure function of the caller's own input and disclose nothing about stored state. Placing the parse before `findByEmail` means an invalid-phone request never reaches the email-existence 409, shrinking the existing oracle. RED: WU2b asserts `usersRepository.findByEmail` is **not** called when the phone is rejected. |
| Outbox / log PII leakage | **Applicable — out of scope by construction.** The `TENANT_REGISTERED` payload (`prisma-auth-registration.repository.ts:59-70`) must not gain the phone. RED: WU2b asserts the emitted payload keys are unchanged. |
| Documentation-like paths / executable classification | N/A — no repository file classification or execution. |
| Routing, shell, subprocess, VCS/PR automation | N/A — 100% repository lines; no operational smoke, deployment or PR automation. |
| Data migration | N/A — `Tenant.whatsappPhone` exists and is already nullable; no Prisma migration file is added. |

## Residuals and follow-ups

| Item | Disposition |
|---|---|
| `phone.too_short` becomes unreachable but stays in the tuple | Frozen 14-prefix forbids removal. Reserved historical code (proposal, decision 6). |
| Legacy uncanonicalisable values block the settings screen | Named above. A "replace this number" affordance is a product follow-up, not this change. |
| Legacy values normalise silently on next write | Named above. Accepted; no bulk backfill. |
| No verification that the submitted number belongs to the registrant | Pre-existing for the settings path; now also at signup. Out of scope. |
| Multi-country support | Needs its own change and its own migration (proposal, out of scope). |
| Client and server both hold a *presence* rule | Deliberate and minimal: shape only, never validity or country (ADR-2). |

## Open Questions

- [ ] None blocking. Decision 6 remains the single item most worth a product override; if it is reversed, WU4 disappears and WU5 loses its PATCH cases — nothing else in this design moves.

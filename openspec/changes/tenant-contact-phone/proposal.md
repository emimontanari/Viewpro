# Proposal: Mandatory Agency Contact Phone at Registration (issue #287)

## Intent

An agency can sign up today and remain permanently unreachable. `RegisterTenantDto` (`register-tenant.dto.ts:3-22`) captures `email`, `password`, `firstName`, `lastName?`, `tenantName` and nothing else, and `Tenant.whatsappPhone` (`schema.prisma:227`) stays `null` until a manager happens to find the settings screen. The owner portal's "Contactar inmobiliaria" affordance depends on that column through `mapTenantWhatsappContact` (`owner-whatsapp-contact.ts:23`), so for every tenant that never filled the form, the property owner has no way to reach the agency.

Capture a valid Argentine contact phone at registration, persist it on the existing column, and make the three ways it can fail distinguishable to the user through catalog error codes.

## Scope

### In Scope

- Capture a required contact phone on `POST /auth/register-tenant`, persisted to the existing `Tenant.whatsappPhone`.
- A new AR-aware parse/validate/canonicalize module built on `libphonenumber-js`, separate from the existing WhatsApp utilities.
- Three new public error codes — `phone.required`, `phone.invalid`, `phone.country_unsupported` — appended to `PUBLIC_ERROR_CODES` (25 → 28), with the MODIFIED delta to the frozen `Canonical public error catalog` requirement that the freeze demands.
- A phone field on the registration form with AR-only country presentation and `errorCode`-driven field messaging.
- Close the divergence on `PATCH /tenants/me/whatsapp-phone`: the same column gets the same rule, and clearing to `null` stops being accepted (see "Resolved decisions", item 6).
- Tests at package, API (forced `NODE_ENV=production`), App New, and e2e layers.

### Out of Scope (explicitly not solved here)

- **No migration.** `Tenant.whatsappPhone` already exists and is already nullable, so issue criterion 5 ("nullable, no fabricated backfill") is satisfied by construction.
- **No country column.** Only AR is supported; the country is implicit in the canonical E.164 value. Multi-country support is a future change that owns its own migration.
- **No backfill or revalidation of stored values.** The new rule is write-time only. Legacy rows keep whatever they hold until their next write.
- **The registration response does not echo the phone.** `GET /tenants/me/whatsapp-phone` already exposes it behind `TENANT_MANAGE_SETTINGS`; widening the unauthenticated-registration response surface buys nothing.
- **The `TENANT_REGISTERED` outbox payload does not carry the phone** (`prisma-auth-registration.repository.ts:56-72`). That payload is a cross-context contract with no consumer for this field; adding a PII-bearing field needs its own justification.
- **`User.whatsappPhone` is untouched.** Registration does not write the personal/seller column today and must not start.
- `phone.too_short` is not removed from the catalog. The frozen prefix forbids it; it stays reserved and stops being emitted.
- `apps/viewpro-api` / `apps/viewpro-web` — separate bounded context, no registration surface.

## Capabilities

### New Capabilities

- `tenant-contact-phone`: registration requires a valid Argentine agency contact phone, persisted canonically; the three failure causes emit distinct public codes and the registration form maps each to its own field message.

### Modified Capabilities

- `safe-public-error-boundary`: the `Canonical public error catalog` requirement freezes the tuple at exactly 25 codes and states that further growth "MUST occur only through an explicit SDD delta to this requirement". This change needs three more, so the spec phase MUST write a MODIFIED delta reproducing the full requirement at 28 codes with the first 14 unchanged and in order.

This delta is load-bearing, not ceremony. `global-exception.filter.ts:74-80` collapses any code outside `PUBLIC_ERROR_CODES` to `REQUEST_FAILED` once `PUBLIC_ERROR_ENVELOPE_ENABLED` is on, and `api-client.ts:1,10` types `ApiError.errorCode` as `PublicErrorCode`. Without the catalog entry the field messages compile-fail on the client and silently vanish on the server the day the flag flips.

## Code set (strict append after `AUTH_TOKEN_INVALID`)

`phone.required`, `phone.invalid`, `phone.country_unsupported`.

Three codes, not one. The issue names three distinct causes, and collapsing them reproduces exactly the defect issue #285 just repaired: several distinct states rendering one wrong panel. "You did not enter a phone", "that is not a valid number" and "we only support Argentina right now" are three different next actions for the user.

Naming follows the dot-lowercase form of the sibling `phone.too_short` rather than the SCREAMING_SNAKE of the `actionable-auth-errors` set, so the phone family stays grouped. The catalog is deliberately heterogeneous already; consistency within the domain prefix beats consistency across the whole tuple.

## Approach

**Reuse `Tenant.whatsappPhone`.** The mandatory agency contact phone is the same concept as the number the owner portal already dials. One column, one meaning, no migration, and the manager-completes-later surface already exists at `/tenants/me/whatsapp-phone` behind `TENANT_MANAGE_SETTINGS` (`tenants-contact.controller.ts:32-49`).

**A sibling validator module, not an extension of the existing one.** `isValidWhatsappPhone` returns `true` for `null` by documented design (`whatsapp-phone.utils.ts:38,42`) and only counts digits; `normalizeWhatsappPhone` strips punctuation without inferring a country or producing canonical E.164. Both are correct for an optional clearable field and wrong for a mandatory one. Stretching them would make one function mean two things.

**Parse with default region AR.** `libphonenumber-js` is the maintained library (standard build, real AR metadata, no repo precedent to contradict). Parsing with `'AR'` as the default region accepts both the national form a manager already typed (`3510000000`) and the international form (`+54 9 351 ...`), canonicalizing both to E.164. This matters beyond convenience: it is what keeps the settings tightening in WU4 from 400-ing existing managers who re-save a pre-filled legacy value they never edited.

**Codes are thrown from the use case, not from the DTO.** Verified constraint: `create-app.ts:35-40` installs a global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` and **no `exceptionFactory`**. A `class-validator` failure therefore produces a `BadRequestException` whose body carries `message: string[]` and **no `errorCode`** — the code would never reach the client. So the DTO declares the field permissively (`@IsOptional() @IsString()`) and the use case owns the required/invalid/unsupported decision. A non-string payload still yields a codeless 400; that is a malformed-client case, not a user-facing one.

**The AR country selector is presentation only.** Because `forbidNonWhitelisted: true` rejects undeclared keys, the form MUST NOT send a `country` field — registration would 400 on the whitelist before reaching any of our logic. `phone.country_unsupported` is produced server-side when the submitted number carries an explicit non-AR calling code (`+56 9 ...` parses as `CL`), which is exactly the case the issue describes.

**No dependency on `PUBLIC_ERROR_ENVELOPE_ENABLED`.** The legacy branch (`global-exception.filter.ts:54`) forwards `errorCode` verbatim in every environment, so the codes work the day they ship and keep working after the flag flips.

## Work units

| WU | Scope | Forecast | Budget risk |
|---|---|---|---|
| 1 | Catalog: +3 codes in `packages/contracts/src/index.ts`, exact-equality and 28-length assertions in `runtime-contract.spec.ts`, MODIFIED delta to the frozen requirement | 60–100 | Low |
| 2 | Backend: `libphonenumber-js` dependency, new AR contact-phone module + its test matrix, DTO field, use case validation, repository port and `tenant.create` wiring, use-case tests | 220–310 | Medium |
| 3 | Registration form: phone field, AR presentation, client schema, `errorCode` → field-message mapping, component tests | 140–200 | Low |
| 4 | Settings unification: PATCH rejects `null` and applies the AR rule, DTO contract doc, use-case tests, BFF Zod contract, `features/settings/schemas/tenant-whatsapp-phone.ts`, settings component messaging and tests | 130–210 | Medium |
| 5 | E2E under `NODE_ENV=production`: absent / invalid / unsupported-country each return their own code with no prose; settings null rejection; permission-gated GET unchanged | 90–150 | Low |

Order: 1 → 2a → 2b → 3 → 4 → 5, strictly sequential. **Superseded by the design**, which split WU2 and fixed the order: WU2 was going to breach the budget not because of its test matrix but because making the field required turns 28 registration fixtures across 20 e2e files red, and those fixes can land neither earlier (the whitelist rejects the field until the DTO declares it) nor later (a red suite in between). The design's rollback ordering also requires WU4 to revert before WU3, so they are not interchangeable. See `design.md` for the confirmed six-unit forecast.

The exploration's four-unit slicing is revised. Its WU2 forecast (150–250) was low: it did not price the validator module's own test matrix, and strict TDD makes those tests authored lines in the same slice. Its plan had no unit for the settings path at all, because it left the validator-coexistence question open; closing that question (decision 6) creates WU4.

WU3 is not merely "add a field". `sign-up-view.tsx:69` currently renders `getApiErrorMessage(error)`, which in production yields the generic `La solicitud falló.` — the same dead-branch shape that forced the `C2` slice in `actionable-auth-errors`. Shipping the codes without touching this view would change nothing a user can see.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/contracts/src/index.ts` | Modified | +3 codes, 25 → 28 |
| `packages/contracts/test/runtime-contract.spec.ts` | Modified | Exact-equality tuple, length 28, prefix still frozen at 14 |
| `apps/api/src/common/phone/` | Added | AR parse/validate/canonicalize module on `libphonenumber-js` |
| `apps/api/src/auth/dto/register-tenant.dto.ts` | Modified | Permissive field declaration |
| `apps/api/src/auth/use-cases/register-tenant.use-case.ts` | Modified | Three-way validation, throws the codes |
| `apps/api/src/auth/repositories/*auth-registration.repository.ts` | Modified | Port input type, `tenant.create` data |
| `apps/api/src/tenants/use-cases/update-tenant-whatsapp-phone.use-case.ts` | Modified | Same rule, `null` rejected |
| `apps/api/src/tenants/dto/update-whatsapp-phone.dto.ts` | Modified | Contract doc no longer says "pass null to clear" |
| `apps/app-new/src/features/auth/components/sign-up-view.tsx` | Modified | Phone field, AR presentation, code-driven messages |
| `apps/app-new/src/lib/session.ts` | Modified | `RegisterTenantInput` gains the field |
| `apps/app-new/src/features/settings/schemas/tenant-whatsapp-phone.ts` | Modified | AR rule replaces the min-digit rule |
| `apps/api/prisma/` | Untouched | No migration |
| `apps/api/src/common/whatsapp/whatsapp-phone.utils.ts` | Untouched | Read-side contract mapping keeps using it |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Green suite, broken production — `sanitizeProductionMessage` is production-only (`global-exception.filter.ts:87-89`) | High | Every backend WU asserts with `NODE_ENV=production`; the harness exists at `errors.e2e-spec.ts` |
| A `country` key added to the payload 400s on `forbidNonWhitelisted` before any phone logic runs | Medium | The selector is presentation-only; e2e asserts the exact submitted body shape |
| Phone validation placed on the DTO produces a codeless 400 and the field messages silently disappear | Medium | Validation lives in the use case by design; a production-mode test asserts the code is present on each of the three failures |
| WU4 400s existing managers who re-save a pre-filled legacy value | Medium | Default region AR canonicalizes national-form legacy values; a test covers a stored `3510000000` round-tripping |
| Legacy stored values that cannot canonicalize (foreign or malformed) stay in the column unnoticed | Low | Accepted residual. Write-time-only rule is explicit; no silent rewrite of persisted data |
| Every newly registered tenant immediately exposes "Contactar inmobiliaria" in the owner portal | Low | Intended outcome, but it is a visible behavior change for owners from day one — worth naming in release notes |
| Catalog exact-equality assertion breaks other packages | Low | Same-change edit; e2e cases derive from the catalog |
| Registration flow gains a required field, so signup completion may dip | Low | Product-accepted; the issue's premise is that unreachable agencies cost more |

## Rollback Plan

Revert in reverse order 5 → 4 → 3 → 2 → 1. Reverting WU4 restores the clearable settings contract. Reverting WU2 restores optional registration; any tenant registered in between keeps its stored phone, which is valid data under the old rules. Reverting WU1 requires WU2, WU3 and WU4 reverted first, otherwise producers reference absent codes. No migration and no flag flip in either direction.

## Dependencies

None. `PUBLIC_ERROR_ENVELOPE_ENABLED` is not required. The `actionable-auth-errors` change is already archived and its 25-code tuple is the base this appends to.

## Success Criteria

- [ ] `PUBLIC_ERROR_CODES` is exactly 28 entries; the first 14 are unchanged and order-frozen; `phone.too_short` is still present.
- [ ] With `NODE_ENV=production`, registering with an absent, invalid, and non-AR phone returns `phone.required`, `phone.invalid`, and `phone.country_unsupported` respectively, each with no server prose.
- [ ] Each of those three renders its own message on the registration form; none falls back to `getApiErrorMessage`.
- [ ] A successful registration persists a canonical E.164 value on `Tenant.whatsappPhone`.
- [ ] A test asserts `user.create` is called without `whatsappPhone`, keeping the personal/agency separation structural.
- [ ] `PATCH /tenants/me/whatsapp-phone` rejects `null` and applies the same AR rule.
- [ ] A stored legacy national-form value re-saved unchanged through the settings form still succeeds.
- [ ] No Prisma migration file is added.
- [ ] Every work unit is under 400 changed lines.

## Resolved decisions

Items 1–5 were settled before this proposal. Do not re-open them.

1. **Reuse `Tenant.whatsappPhone`.** Same concept as the owner portal's agency contact. No migration; the column exists and is already nullable. The later-completion surface is the existing `/tenants/me/whatsapp-phone` settings screen.
2. **Three distinct error codes**, not one. The issue names three causes, and collapsing them repeats the #285 defect.
3. **`libphonenumber-js`** is the maintained library. No monorepo precedent existed; the issue defers the choice but requires documenting it.
4. **Country is implicit AR and is not persisted.** A country column would contradict decision 1's no-migration property.
5. **The registration response does not echo the phone.** The permission-gated settings GET already exposes it.
6. **Clearing the agency phone stops being allowed; the settings path adopts the registration rule.** Decided here — see below.

### Decision 6 in full: the settings-clear hole

Reusing one column for two rules opens a hole. `UpdateWhatsappPhoneDto` explicitly documents "Pass null to clear the stored phone number", and `isValidWhatsappPhone(null)` returns `true`, so `update-tenant-whatsapp-phone.use-case.ts:20-27` happily writes `null`. A tenant could register with a valid number and empty it one PATCH later, defeating the whole change.

**Decision: `PATCH /tenants/me/whatsapp-phone` MUST reject `null`, and MUST apply the same AR/E.164 rule as registration, emitting the same three codes.**

Rationale. The issue's own wording is "los gestores autorizados pueden **completar o actualizar** el contacto" — complete or update, never clear. And leaving two validators with different rules on one column is precisely the defect shape this codebase just spent issue #285 repairing: divergent rules on one surface produce states nobody designed. If a number is mandatory at the front door, it is mandatory at the side door.

Consequences, stated plainly:

- An established API contract changes semantics. The DTO's documented "pass null to clear" becomes false, and the mirrored BFF Zod contract must follow. This is a behavior change to a shipped endpoint, not an additive one, which is why WU4 exists as its own slice.
- `phone.too_short` stops being emitted anywhere. It cannot be removed — the frozen 14-code prefix forbids that — so it stays in the tuple as a reserved historical code.
- An agency whose line is disconnected can no longer remove a dead number; it must replace it. The owner portal will keep offering a contact that may not answer. This is the real cost of the decision and the honest counterargument to it: forcing a value can produce a *fabricated* value, which is the very thing criterion 5 warns against elsewhere. The judgment is that a stale number is a support problem while an absent number is a structural one, and only the second is what the issue asks us to fix.
- Existing tenants sitting at `null` are unaffected until their first write, at which point they must supply a valid number. That is the intended "complete later" path.

This is the single decision in this proposal most worth a product override. If the answer is instead "clearing stays allowed and mandatory-ness is registration-time only", the change is strictly smaller: WU4 disappears, `phone.too_short` keeps its current meaning, and the proposal must state as an accepted residual that the mandatory invariant holds only at signup. Nothing else in the plan moves.

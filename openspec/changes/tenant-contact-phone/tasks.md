# Tasks: Mandatory Agency Contact Phone at Registration (#287)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 835–1155 total across 6 units (45–75 / 175–210 / 175–235 / 155–210 / 185–260 / 100–165) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (WU1) → PR2 (WU2a) → PR3 (WU2b) → PR4 (WU3) → PR5 (WU4) → PR6 (WU5) |
| Delivery strategy | ask-on-risk |
| Chain strategy | `sequential-to-develop` — confirmed by the maintainer |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: sequential-to-develop

Every slice targets `develop` directly and lands in the strict order above, never stacked on the previous branch. Stacking is not an option in this repository: `.github/workflows/ci.yml` only triggers on `pull_request` with base `develop` or `main`, so a PR based on a feature branch runs neither `Test` nor `Build · Typecheck · Lint` — it shows CodeRabbit and Vercel green and no tests at all. Sequential-to-develop is the only shape that gets a slice actually verified before it merges.
400-line budget risk: Medium

No single unit is forecast to exceed 400 lines; WU4 (185–260, 140-line headroom) is closest and carries the settings-inversion risk the design flagged as "revised up." Given the strict sequential dependency chain (each unit imports the previous one's production code) and the explicit WU3/WU2b revert coupling below, **feature-branch-chain** is the natural fit — recommend it to the user, but the choice is theirs to confirm per `ask-on-risk`.

### Suggested Work Units

| Unit / PR | Start → finish | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| WU1 / PR1 | Catalog +3 codes → 28-entry exact-equality | `pnpm --filter @viewpro/contracts test` | N/A — pure catalog/type change, no live app | Revert `index.ts` + `runtime-contract.spec.ts`. **Revert last** — any surviving `phone.*` producer with no catalog entry fails the client's `satisfies Partial<Record<PublicErrorCode,…>>` typecheck. |
| WU2a / PR2 | `libphonenumber-js` dep → `parseArContactPhone` module | `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts` | N/A — pure function, colocated unit spec only | Delete `src/common/phone/`, revert `package.json` dep. Safe only once WU2b and WU4 no longer import it. |
| WU2b / PR3 | DTO/use-case/repository wiring + 28 fixtures | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/register-tenant.use-cases.spec.ts test/public-error-annotations.spec.ts` | Hermetic `GlobalExceptionFilter('production', undefined, {})` + direct `ArgumentsHost` (ADR-5); full suite proves all 28 fixture sites | Revert DTO, use case, both registration repositories, `public-error-annotations.spec.ts`, 19 e2e files; delete `register-tenant.use-cases.spec.ts`. Restores optional registration; tenants registered meanwhile keep valid stored phones. |
| WU3 / PR4 | Registration form field + code-driven messages | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/sign-up-view.test.tsx` | Vitest + Testing Library render; no live app/BFF in this flow | Revert `sign-up-view.tsx`, `session.ts`; delete `sign-up-view.test.tsx`. **Coupled to WU2b**: reverting the client alone against an API that still requires the field breaks registration outright — revert together with or before WU2b, never after. |
| WU4 / PR5 | Settings PATCH parity, rejects `null` | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/tenants-whatsapp.use-cases.spec.ts test/public-error-annotations.spec.ts && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/settings` | Same hermetic filter harness + Testing Library render | Revert settings DTO, use case, both settings specs, BFF doc, client schema, `tenant-contact-form.{tsx,test.tsx}`. Restores clearable settings contract and `phone.too_short` emission; independent of WU3. |
| WU5 / PR6 | E2E for the three codes + settings null + permission gate | `pnpm --filter @viewpro/api exec vitest run test/register-tenant-phone.e2e-spec.ts` | Real supertest boot at `NODE_ENV=test` (ADR-5: production cannot boot) | Delete `test/register-tenant-phone.e2e-spec.ts`. Test-only, no production reference. |

## Phase 1: WU1 — Catalog Growth to 28 Codes

- [x] 1.1 RED: In `packages/contracts/test/runtime-contract.spec.ts`, add `phoneContactPublicErrorCodes` and fold it into `expectedPublicErrorCodes`; add `expect(contract.codes).toHaveLength(28)`. `pnpm --filter @viewpro/contracts test`
- [x] 1.2 GREEN: Append `phone.required`, `phone.invalid`, `phone.country_unsupported` after `'AUTH_TOKEN_INVALID'` in `packages/contracts/src/index.ts`. Rerun 1.1's command unchanged; confirm GREEN.
- [x] 1.3 REFACTOR: `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck`

## Phase 2: WU2a — AR Contact Phone Parser Module

- [x] 2.1 RED: Create `apps/api/src/common/phone/ar-contact-phone.spec.ts` against the not-yet-existing module: the full four-verdict matrix (required ×5, invalid ×4, unsupported ×3, ok ×5 including legacy `3510000000`). `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts`
- [x] 2.2 GREEN: Add `libphonenumber-js` (default/min entry) to `apps/api/package.json` dependencies, `pnpm install`; create `apps/api/src/common/phone/ar-contact-phone.ts` implementing `parseArContactPhone(input: unknown)` per ADR-1's four-step ordered verdict. Rerun 2.1's command unchanged; confirm GREEN.
- [x] 2.3 REFACTOR: `pnpm --filter @viewpro/api exec vitest run src/common/phone src/common/whatsapp && pnpm --filter @viewpro/api typecheck` (the `whatsapp` leg proves the sibling module was added without disturbing `whatsapp-phone.utils.ts`).

## Phase 3: WU2b — Registration Wiring and Fixtures

- [ ] 3.1 RED: Create `apps/api/test/register-tenant.use-cases.spec.ts` (three rejections; one success asserting the E.164 written to `tenant.create`; one asserting `tx.user.create` is called with no `whatsappPhone` key). Append the three production boundary cases to `apps/api/test/public-error-annotations.spec.ts`. `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/register-tenant.use-cases.spec.ts test/public-error-annotations.spec.ts`
- [ ] 3.2 GREEN: `register-tenant.dto.ts` → `@IsOptional() @IsString() whatsappPhone?: string`; `register-tenant.use-case.ts` → call `parseArContactPhone` as the first statement, before `usersRepository.findByEmail`, throw `BadRequestException({ errorCode })` on `ok:false`; `auth-registration.repository.ts` port field; `prisma-auth-registration.repository.ts` `tenant.create` data. Rerun 3.1's command unchanged; confirm GREEN.
- [ ] 3.3 GREEN: Add a valid `whatsappPhone` value to all 28 `.post('/api/auth/register-tenant')` fixture bodies across the 19 affected e2e spec files. This cannot land in an earlier slice — `forbidNonWhitelisted: true` would reject the key before this DTO declares it — and cannot land after 3.2, which would leave the full API e2e suite red in between; both changes are one atomic GREEN step.
- [ ] 3.4 REFACTOR: `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck` — the full suite is mandatory here; it is the only proof all 28 fixture sites were found.

## Phase 4: WU3 — Registration Form

- [ ] 4.1 RED: Create `apps/app-new/src/features/auth/components/sign-up-view.test.tsx` (new file): reject `registerTenant` with each of the three codes, asserting a distinct field-level message never equal to the generic `getApiErrorMessage` string; one case asserting the submitted body has exactly the five known keys plus `whatsappPhone` and no `country` key. `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/sign-up-view.test.tsx`
- [ ] 4.2 GREEN: Add `whatsappPhone` to `RegisterTenantInput` in `apps/app-new/src/lib/session.ts`; add a phone `FormTextField` plus a static AR affordance (outside the form value object, never a form field) and a code→message map consulted before the `getApiErrorMessage` fallback in `sign-up-view.tsx`. Rerun 4.1's command unchanged; confirm GREEN.
- [ ] 4.3 REFACTOR: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib && pnpm --filter next-shadcn-dashboard-starter typecheck`

## Phase 5: WU4 — Settings Parity

- [ ] 5.1 RED: Invert `tenants-whatsapp.use-cases.spec.ts` (`null`/`''`/whitespace → `phone.required`; `'3510000000'` → persists `'+543510000000'`; `'+5691234567'` → `phone.country_unsupported`); invert e2e S-2/S-3 in `tenants-whatsapp.e2e-spec.ts`; rewrite `tenant-contact-form.test.tsx`. `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/tenants-whatsapp.use-cases.spec.ts test/public-error-annotations.spec.ts && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/settings`
- [ ] 5.2 GREEN: `update-whatsapp-phone.dto.ts` → `@IsOptional() @IsString() whatsappPhone?: string | null`, drop `@IsDefined`/`@ValidateIf`, replace the "pass null to clear" doc comment; `update-tenant-whatsapp-phone.use-case.ts` → drop the `whatsapp-phone.utils` imports, call `parseArContactPhone`; `apps/app-new/.../whatsapp-phone/route.ts` doc comment only (Zod stays `z.string().nullable()` per ADR-6); `features/settings/schemas/tenant-whatsapp-phone.ts` → drop `MIN_DIGIT_COUNT`/`countDigits`/`phone.too_short` refine, keep a presence check only; `tenant-contact-form.tsx` → submit the trimmed raw value, replace `` `Error: ${errorCode}` `` with the three real messages. Rerun 5.1's command unchanged; confirm GREEN.
- [ ] 5.3 REFACTOR: `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/settings src/app/api/tenants && pnpm --filter next-shadcn-dashboard-starter typecheck`

## Phase 6: WU5 — E2E Boundary Proof

- [ ] 6.1 RED: Create `apps/api/test/register-tenant-phone.e2e-spec.ts`: absent/`''`/whitespace → 400 `phone.required`; `'123'` → 400 `phone.invalid`; `'+56 9 1234 5678'` → 400 `phone.country_unsupported`; valid national and international forms → 201 with canonical E.164 read back via the permission-gated GET; `whatsappPhone: 123` → 400 with no `errorCode`; `country: 'AR'` in the body → 400 from the whitelist; PATCH `null` → 400 `phone.required`; GET without `TENANT_MANAGE_SETTINGS` → 403 unchanged. `pnpm --filter @viewpro/api exec vitest run test/register-tenant-phone.e2e-spec.ts`
- [ ] 6.2 GREEN: No production code change expected. If any case fails, fix the defect in WU2b or WU4, not here. Rerun 6.1's command unchanged until GREEN. No `NODE_ENV=production` prefix — the spec sets `NODE_ENV='test'` in its own `beforeAll` and the app cannot boot production (ADR-5).
- [ ] 6.3 REFACTOR: `pnpm --filter @viewpro/api exec vitest run && pnpm --filter @viewpro/api typecheck`

## Deferred / Out of Scope

No Prisma migration or country column (AR is implicit in E.164); no phone echo on the registration response; `TENANT_REGISTERED` outbox payload unchanged; `User.whatsappPhone` untouched; `phone.too_short` stays reserved and unreachable; no backfill or revalidation of stored legacy values; multi-country support needs its own change and migration.

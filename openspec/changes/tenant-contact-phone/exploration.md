# Exploration: Mandatory agency contact phone at registration (issue #287)

## Current registration path

- Controller `apps/api/src/auth/auth.controller.ts:48-55` — `POST /auth/register-tenant`.
- DTO `apps/api/src/auth/dto/register-tenant.dto.ts:1-22` — `email`, `password`, `firstName`, `lastName?`, `tenantName`. **No phone, no country.**
- Use case `apps/api/src/auth/use-cases/register-tenant.use-case.ts:47-76` — uniqueness, slug, hash, delegate, session, verification email.
- Repository `apps/api/src/auth/repositories/prisma-auth-registration.repository.ts:19-76` — one `$transaction` creating `User`, `Tenant`, `TenantMembership`, then a `TENANT_REGISTERED` outbox event whose payload (`:59-70`) carries no phone.
- Response mappers under `apps/api/src/auth/responses/` expose no phone field.

Frontend: `apps/app-new/src/features/auth/components/sign-up-view.tsx:19-131` is the only registration form in the repo; `apps/viewpro-web` does not own registration. Submission goes through `apps/app-new/src/lib/session.ts:60-65`, a **direct** `apiRequest` call — unlike `/tenants/me/whatsapp-phone`, registration has **no Next.js BFF route**.

## The existing phone utilities do not fit a mandatory field

`apps/api/src/common/whatsapp/whatsapp-phone.utils.ts:27-45`:

- `normalizeWhatsappPhone` strips non-`+`/digit characters. It does **not** produce canonical E.164 — no country-code inference, no numbering-plan validation.
- `isValidWhatsappPhone` returns **`true` for `null`**, documented as "represents a clear/unset operation", and otherwise only requires `>= MIN_WHATSAPP_DIGITS` decimal digits.

That null-is-valid semantics is correct for an optional, clearable settings field and **exactly wrong for a mandatory registration field**, where absent must be rejected. The frontend mirrors the same regex rule at `apps/app-new/src/features/settings/schemas/tenant-whatsapp-phone.ts:1-36`, duplicating the logic.

**No maintained phone-parsing library** (`libphonenumber-js`, `google-libphonenumber`, `awesome-phonenumber`) exists in any `package.json` in the monorepo. Criterion 6 requires one.

## Data model

`apps/api/prisma/schema.prisma`:

- `model User:187` — `whatsappPhone String?`, the **personal/seller** phone, read by `mapAssignedSellerWhatsappContact` (`apps/api/src/owner-portal/owner-whatsapp-contact.ts:41-70`).
- `model Tenant:227` — `whatsappPhone String?`, the **agency** phone, written by `UpdateTenantWhatsappPhoneUseCase` (`apps/api/src/tenants/use-cases/update-tenant-whatsapp-phone.use-case.ts:14-28`) and read by `mapTenantWhatsappContact`.
- Both added by `apps/api/prisma/migrations/20260601120000_add_whatsapp_contact_fields/migration.sql` as plain nullable `ALTER TABLE ... ADD COLUMN`, no backfill. That is the repo's convention for this kind of change.
- **No `country` column exists** on `Tenant` or `User`.

Criterion 5 ("nullable, no fabricated backfill") is therefore already satisfied for free **if** the new field reuses `Tenant.whatsappPhone`.

## Personal/agency separation

The two columns live on different models, with different repositories and different read-side mappers carrying distinct labels ("Contactar inmobiliaria" versus "Consultar responsable"). **No existing code path copies one into the other**, and registration does not touch `User.whatsappPhone` at all today. Criterion 4 is structurally enforced already; the only new risk is wiring the registration path to touch the personal column.

## Safe field-level errors must travel as codes, not prose

`apps/api/src/common/filters/global-exception.filter.ts:54` — the legacy branch forwards `body.errorCode` verbatim in **every** environment; only `message` is sanitized in production (`:87-91`). So the catalogued code is the only reliable channel, and it already works today with the envelope flag off.

`:74-80` — once `PUBLIC_ERROR_ENVELOPE_ENABLED` is on, any code **not** in `PUBLIC_ERROR_CODES` collapses to `REQUEST_FAILED`. The catalog is frozen at exactly 25 entries by `openspec/specs/safe-public-error-boundary/spec.md`, which requires an explicit SDD delta to grow. **So the error-code decision is load-bearing for the future rollout, not cosmetic.**

Client side, `apps/app-new/src/lib/api-client.ts:21-42` already filters `errorCode` through `isPublicErrorCode`. There is no shared code-to-copy dictionary: every consumer does its own local branch.

## Approaches

**A. Reuse `Tenant.whatsappPhone`.** No migration (column exists, already nullable), the manager-completes-later surface already exists at `/tenants/me/whatsapp-phone`, smallest surface. Cost: it conflates "WhatsApp click-to-contact for owners" with "mandatory business contact captured at signup", and leaves two validators with different rules on one column — the settings PATCH path stays null-is-valid while registration must reject absent.

**B. Add a distinct field** (`Tenant.contactPhone`, optionally `Tenant.contactCountry`). Clean semantic separation, an explicit place for multi-country growth. Cost: a migration, plus a new or extended settings surface for the later-completion path.

Both approaches still need a real AR/E.164 validator built on a maintained library. Neither existing utility qualifies.

## Candidate slicing under the 400-line budget

- **WU1** Catalog delta, only if new codes are needed — `packages/contracts/src/index.ts` plus a delta to the frozen requirement. Small, but carries SDD process weight; own slice regardless of size, landed first.
- **WU2** Backend: new AR/E.164 module on a maintained library, DTO, use case, repository, unit tests. 150-250 lines. Largest slice.
- **WU3** Frontend: country selector (AR only), phone field, schema validation, code-driven field messaging, component tests. 100-150 lines.
- **WU4** E2E and authorization coverage for absent, invalid and unsupported-country. 60-120 lines.

Approach B adds a **WU0** migration slice of roughly 10-20 lines ahead of WU2.

## Open questions — product decisions, not engineering ones

1. **Field identity.** Is the mandatory agency contact phone the same concept as the existing `Tenant.whatsappPhone`, or a distinct field? This alone decides whether a migration exists and which UI is the later-completion surface.
2. **Country persistence.** Only AR is supported now. Store a country value for clean multi-country growth, or leave AR implicit with no column?
3. **Error-code granularity.** Does `phone.too_short` cover absent, invalid and unsupported-country, or does criterion 6's demand for distinguishable coverage imply distinct codes? Determines whether a catalog-freeze delta is required at all.
4. **Library choice.** The issue defers it but requires documenting it. No repo precedent.
5. **Response exposure** (criterion 7). Must the registration response echo the persisted phone, or is silent acceptance enough given the permission-gated settings GET?
6. **Validator coexistence** (only under Approach A). Tighten the settings PATCH rule to match, or leave it deliberately looser?

## Readiness

**Not ready for proposal.** Questions 1 and 3 materially change scope, migration need and whether a catalog delta is required. Resolve them before drafting.

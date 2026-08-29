# Tenant Contact Phone Specification

## Purpose

Agency registration leaves `Tenant.whatsappPhone` `null` until a manager finds the settings screen, so the owner portal's "Contactar inmobiliaria" affordance has nothing to show. This capability makes a valid Argentine agency contact phone mandatory at registration, persisted canonically on the existing column, enforces the same rule on the one settings surface that can change it, and makes each of the three ways it can fail distinguishable to the client through a public error code.

## Requirements

### Requirement: Catalog growth to twenty-eight codes

`PUBLIC_ERROR_CODES` MUST append exactly three codes after `AUTH_TOKEN_INVALID`, in this exact order: `phone.required`, `phone.invalid`, `phone.country_unsupported`. The resulting tuple MUST total exactly 28 codes; the first 25 codes MUST remain unchanged and order-frozen.

#### Scenario: Exact append order and count
- GIVEN the runtime `PUBLIC_ERROR_CODES` tuple after this change
- WHEN its length and order are asserted
- THEN it has exactly 28 entries, the first 25 match the pre-existing frozen prefix, and entries 26-28 match the append order above

#### Scenario: No duplicate or reordered codes
- GIVEN the appended 3 codes
- WHEN uniqueness is checked against the full 28-code tuple
- THEN every code appears exactly once and none collides with an existing code

### Requirement: Required Argentine contact phone at registration

The system MUST require a valid Argentine (AR) contact phone on `POST /auth/register-tenant`, persisted to `Tenant.whatsappPhone`. An absent phone MUST fail with `errorCode: phone.required`. A phone that cannot be parsed as a valid AR number MUST fail with `errorCode: phone.invalid`. A phone that parses with an explicit non-AR calling code MUST fail with `errorCode: phone.country_unsupported`. Each failure MUST return HTTP 400.

#### Scenario: Registration succeeds with a valid AR phone
- GIVEN a registration payload with a valid Argentine phone number
- WHEN `POST /auth/register-tenant` is submitted
- THEN the tenant is created and its canonical phone is persisted to `Tenant.whatsappPhone`

#### Scenario: Absent phone is rejected
- GIVEN a registration payload with no phone field
- WHEN `POST /auth/register-tenant` is submitted
- THEN the response is HTTP 400 with `errorCode: phone.required`

#### Scenario: Unparseable phone is rejected
- GIVEN a registration payload with a phone value that does not parse as a valid AR number
- WHEN `POST /auth/register-tenant` is submitted
- THEN the response is HTTP 400 with `errorCode: phone.invalid`

#### Scenario: Non-AR calling code is rejected
- GIVEN a registration payload with a phone value carrying an explicit non-AR calling code
- WHEN `POST /auth/register-tenant` is submitted
- THEN the response is HTTP 400 with `errorCode: phone.country_unsupported`

### Requirement: Field validation occurs in the use case, not the DTO

Because the global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true` and no `exceptionFactory`, a `class-validator` failure produces a body with `message: string[]` and no `errorCode`. The phone field's required/invalid/unsupported decision MUST be implemented in the registration use case, not as `class-validator` decorators on `RegisterTenantDto`. The DTO MUST declare the field permissively so a present value reaches the use case instead of being rejected by the pipe.

#### Scenario: DTO declares the field permissively
- GIVEN `RegisterTenantDto`'s phone field
- WHEN it is submitted with any string value, valid or invalid
- THEN the global `ValidationPipe` does not reject it, and control reaches the registration use case

#### Scenario: Non-string phone yields a codeless 400
- GIVEN a registration payload where the phone field is not a string
- WHEN `POST /auth/register-tenant` is submitted
- THEN the response is a class-validator-shaped 400 with no `errorCode`, an accepted malformed-client case outside this requirement's guarantee

### Requirement: Production-mode code emission for phone failures

Every phone-validation failure at registration and at the settings update path MUST emit its assigned `errorCode` under `NODE_ENV=production`, because `sanitizeProductionMessage` (`global-exception.filter.ts:87`) collapses every 400 message to a generic sanitized string only in that mode. A test suite that does not force `NODE_ENV=production` MUST NOT be treated as sufficient evidence that a phone `errorCode` reaches the client.

#### Scenario: Codes survive production sanitization
- GIVEN `NODE_ENV=production`
- WHEN registration or the settings PATCH rejects an absent, invalid, or unsupported-country phone
- THEN the response body's `errorCode` matches the corresponding catalog code and `message` is the generic sanitized string

#### Scenario: Development-mode-only suite is insufficient evidence
- GIVEN a test suite asserting a phone `errorCode` without setting `NODE_ENV=production`
- WHEN it is offered as verification of client-visible behavior
- THEN it MUST NOT be accepted as proof, because `sanitizeProductionMessage` never activates outside production mode

### Requirement: Settings phone update enforces the same mandatory rule

`PATCH /tenants/me/whatsapp-phone` MUST NOT accept `null`. It MUST apply the same AR validation rule as registration and emit the same three codes (`phone.required`, `phone.invalid`, `phone.country_unsupported`) for the same three failure causes, replacing its prior `phone.too_short` emission.

#### Scenario: Null is rejected
- GIVEN an authorized settings PATCH with `whatsappPhone: null`
- WHEN the request is submitted
- THEN the response is HTTP 400 with `errorCode: phone.required`

#### Scenario: Same rule, same codes
- GIVEN an authorized settings PATCH with an invalid or non-AR phone
- WHEN the request is submitted
- THEN the response uses `phone.invalid` or `phone.country_unsupported` matching registration's rule, and a valid AR phone is persisted as canonical E.164

### Requirement: Canonical E.164 storage with AR default region

Parsing MUST use `AR` as the default region, so both national-form (for example `3510000000`) and international-form (for example `+54 9 351 ...`) input canonicalize to E.164 rather than failing validation. The value persisted on `Tenant.whatsappPhone` MUST always be canonical E.164 on success.

#### Scenario: National-form input canonicalizes
- GIVEN a registration or settings submission with a national-form AR number such as `3510000000`
- WHEN it is validated
- THEN it canonicalizes to E.164 and is persisted, without emitting `phone.invalid`

#### Scenario: Legacy stored value round-trips on unedited re-save
- GIVEN a tenant whose stored `whatsappPhone` is a legacy national-form value
- WHEN a manager re-saves that unedited value through the settings PATCH
- THEN it canonicalizes and succeeds rather than returning `phone.invalid`

### Requirement: Personal phone remains untouched

Registration and the settings phone update path MUST NOT write to `User.whatsappPhone`, and MUST NOT copy or synchronize the agency contact phone into it.

#### Scenario: Registration does not touch the personal phone
- GIVEN a tenant registration with a valid agency contact phone
- WHEN the registration transaction executes
- THEN the `User` creation call is invoked without a `whatsappPhone` field

#### Scenario: Settings update does not touch the personal phone
- GIVEN an authorized settings PATCH updating `Tenant.whatsappPhone`
- WHEN the update executes
- THEN no write to `User.whatsappPhone` occurs

### Requirement: Country selection is presentation-only

The registration and settings request bodies MUST NOT accept a `country` key; because the global `ValidationPipe` runs with `forbidNonWhitelisted: true`, submitting one MUST 400 on the whitelist before any phone logic runs. `phone.country_unsupported` MUST be derived only from an explicit non-AR calling code parsed out of the submitted phone value itself.

#### Scenario: An extra country key 400s on the whitelist
- GIVEN a registration payload that includes an undeclared `country` key
- WHEN it is submitted
- THEN the response is HTTP 400 from `forbidNonWhitelisted`, before any phone validation runs

#### Scenario: Country unsupported is derived from the phone value
- GIVEN a phone value that parses to a non-AR country (for example a `+56` Chilean number)
- WHEN it is validated
- THEN `errorCode: phone.country_unsupported` is returned without any `country` field having been submitted

## Explicit Non-Goals

- No Prisma migration; `Tenant.whatsappPhone` is reused unchanged. No `country` column is added; AR is implicit in the canonical E.164 value.
- The registration response does not echo the persisted phone.
- The `TENANT_REGISTERED` outbox event payload is unchanged; it does not carry the phone.
- Existing tenants stored at `null` are unaffected until their next settings write; there is no banner, migration, or blocking step forcing completion in this change.
- `phone.too_short` is not removed from `PUBLIC_ERROR_CODES`. It remains a reserved code in the frozen prefix with no emitter after this change.
- Multi-country support, backfill, or revalidation of previously stored values is out of scope.

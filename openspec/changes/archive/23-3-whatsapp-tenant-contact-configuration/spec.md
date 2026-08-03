# Spec — Stage 23.3 Tenant WhatsApp Contact Configuration

## Status

Accepted — 2026-06-16

## Origin

- Proposal: `openspec/changes/23-3-whatsapp-tenant-contact-configuration/proposal.md`
- Plan reference: `docs/plans/2026-06-04-final-mvp-execution-plan.md:304-309`
- Audit row: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md:42`

---

## Functional Requirements

**FR-1** — `PATCH /tenants/me/whatsapp-phone` accepts `{ whatsappPhone: string | null }` and returns **204 No Content** on success. (Response body is empty; the client re-fetches if it needs the updated value.)

**FR-2** — The endpoint is gated by `AuthGuard`, `TenantMembershipGuard`, and `PermissionGuard(@RequirePermissions(TENANT_MANAGE_SETTINGS))`. A request from a user who lacks `TENANT_MANAGE_SETTINGS` receives **403**.

**FR-3** — When `whatsappPhone` is `null`, an empty string, or a whitespace-only string, the use case persists `null` on `Tenant.whatsappPhone` (clear operation). This makes the owner-portal contact-resolution return the no-config state (unchanged read-side behavior).

**FR-4** — When `whatsappPhone` is a non-empty string, the use case strips all characters that are not `+` or a decimal digit, then counts the remaining digits. If the digit count is **< 8**, the endpoint returns **400** with a stable error code `phone.too_short`.

**FR-5** — A leading `+` is preserved in storage (e.g. `+5493510000000` stays as-is). Characters that are neither `+` nor decimal digits are stripped before validation and storage.

**FR-6** — `UpdateTenantWhatsappPhoneUseCase` persists the validated/normalized value atomically through the tenants repository (`updateWhatsappPhone(tenantId, value | null)`). The endpoint always operates on the caller's session tenant; no arbitrary `tenantId` may be supplied via body or path.

**FR-7** — The BFF route `PATCH /api/tenants/me/whatsapp-phone` forwards the request body verbatim to the NestJS endpoint with the session cookie attached. It propagates the API response status (204, 400, 401, 403) and body without modification.

**FR-8** — The tenant settings editor page is rendered only when the active session carries `TENANT_MANAGE_SETTINGS`. Users without the permission are either redirected or see the page hidden (design decides which). The permission check uses the frontend `TENANT_PERMISSIONS` helper after `TENANT_MANAGE_SETTINGS` is added to it.

**FR-9** — The editor form is prefilled with the current `Tenant.whatsappPhone` value retrieved from the tenant context available at page load (either session enrichment or a GET call — design decides). An empty field signals the no-config state.

**FR-10** — On successful save, the UI shows a toast confirmation. On a failed save (4xx/5xx), the UI shows an error toast that includes the API error code or message.

**FR-11** — The 23.1 owner-portal contact resolution is **unchanged**: it continues to read `Tenant.whatsappPhone`; when null it renders `Contacto no configurado`. This slice adds only the write path.

**FR-12** — The Stage 26.2 seed contract is **unchanged**: `seed-demo.mjs` continues to set `Tenant.whatsappPhone` to the demo value (`VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? '+5493510000000'`). The editor provides a runtime override on top of the seeded value.

---

## Acceptance Scenarios

**S-1 — Valid phone, PRINCIPAL_MANAGER**
- Given: authenticated session with `TENANT_MANAGE_SETTINGS`
- When: `PATCH /tenants/me/whatsapp-phone` with `{ whatsappPhone: "+5493510000000" }`
- Then: 204, `Tenant.whatsappPhone` in DB equals `"+5493510000000"`

**S-2 — Clear phone to null, PRINCIPAL_MANAGER**
- Given: authenticated session with `TENANT_MANAGE_SETTINGS` and an existing phone value
- When: `PATCH /tenants/me/whatsapp-phone` with `{ whatsappPhone: null }`
- Then: 204, `Tenant.whatsappPhone` in DB is `null`

**S-3 — Phone too short**
- Given: authenticated session with `TENANT_MANAGE_SETTINGS`
- When: `PATCH /tenants/me/whatsapp-phone` with `{ whatsappPhone: "123" }`
- Then: 400, response body contains error code `phone.too_short`

**S-4 — MANAGER role (no TENANT_MANAGE_SETTINGS)**
- Given: authenticated session with MANAGER role (no `TENANT_MANAGE_SETTINGS`)
- When: `PATCH /tenants/me/whatsapp-phone` with any body
- Then: 403

**S-5 — AGENT role**
- Given: authenticated session with AGENT role
- When: `PATCH /tenants/me/whatsapp-phone` with any body
- Then: 403

**S-6 — Unauthenticated**
- Given: no valid session
- When: `PATCH /tenants/me/whatsapp-phone` with any body
- Then: 401

**S-7 — BFF propagates API 400**
- Given: the API returns 400 with `{ errorCode: "phone.too_short" }`
- When: the BFF receives the upstream response
- Then: BFF responds with 400 and the same body to the client

**S-8 — Editor page visible with permission**
- Given: session has `TENANT_MANAGE_SETTINGS`
- When: user navigates to the tenant settings editor page
- Then: the phone editor form is rendered

**S-9 — Editor page hidden without permission**
- Given: session lacks `TENANT_MANAGE_SETTINGS`
- When: user navigates to the tenant settings editor page
- Then: the form is hidden or the user is redirected away

**S-10 — Form prefill and submit**
- Given: editor page is loaded and `Tenant.whatsappPhone` has an existing value
- When: user clears the field, types a valid new phone, and submits
- Then: the BFF is called with the new value, a success toast appears, and the stored phone matches the new value on reload

**S-11 — Form client-side validation blocks short phone**
- Given: editor form is visible
- When: user types a phone with fewer than 8 digits and attempts to submit
- Then: submission is blocked and a validation error is displayed; no network call is made

**S-12 — Seeded smoke round-trip (PRINCIPAL_MANAGER)**
- Given: demo dataset seeded with `seed-demo.mjs`
- When: demo principal manager navigates to the tenant settings editor, changes the phone to a test value, submits, then reloads the page
- Then: the editor shows the updated phone value; at the end of the test the original seeded value is restored to preserve idempotency

---

## Non-Functional Notes

- **No new dependency** — phone validation reuses the existing `owner-whatsapp-contact.ts` digit-count helper from 23.1.
- **No schema migration** — `Tenant.whatsappPhone String?` already exists since 23.1.
- **No persona/style impact** — UI copy (labels, toasts, placeholders) is in Spanish; all code identifiers, comments, and API contracts are in English.
- **Triple-layer permission gate** — `TENANT_MANAGE_SETTINGS` is enforced at the NestJS guard layer, the BFF route layer (session check before forwarding), and the Next.js page layer (render condition or redirect).
- **Pre-existing baselines must stay green** — 665 API tests, 419 app-new tests, 27 seeded smoke tests.

## Spec Deltas Required

`false` — this is a net-additive change. No existing spec is modified by this slice.

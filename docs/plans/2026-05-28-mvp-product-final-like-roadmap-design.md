# ViewPro MVP Product-Final-Like Roadmap Design

This plan turns the remaining ViewPro MVP work into operational stages and small reviewable slices. The goal is not a demo-only app: a real inmobiliaria should be able to run the core workflow without ViewPro manually patching users, owner accounts, documents, or tenant limits in the database.

## Decision

Build the **product-final-like MVP** path.

| Option | Decision | Why |
|---|---|---|
| Pilot rápido | Rejected | Too many manual operations would remain hidden behind the product. |
| Product-final-like MVP | Accepted | Keeps scope smaller than full SaaS, but makes the product operational for a real inmobiliaria. |
| SaaS completo | Rejected for now | Billing automation, full commercial onboarding, and deep integrations are too large before validation. |

## Success definition

The MVP is operational when one inmobiliaria can:

1. register/login and operate in its tenant;
2. invite managers/sellers and assign properties;
3. create and manage property engagements;
4. link and activate owners without seed/manual DB work;
5. publish follow-up movements/statuses;
6. request, receive, review, approve, and reject documents;
7. let owners read follow-up and respond to document requests;
8. use WhatsApp contact links with property context;
9. receive real in-app notifications for important events;
10. be controlled by ViewPro admin limits/status without direct DB edits;
11. pass seeded and end-to-end smoke tests for the full workflow.

## Stage map

| Stage | Name | Outcome |
|---|---|---|
| 20 | Documentación end-to-end | Document request, owner upload, internal review, status, and version history work in `app-new`. |
| 21 | Invitaciones propietarios | Owner accounts can be invited, activated, revoked, and reused across agencies. |
| 22 | Equipo real | Managers/sellers can be invited and managed from the app, without mock users. |
| 23 | Comunicación | WhatsApp contact links use real contact data and emit measurable events. |
| 24 | Notificaciones reales | Notification center is API-backed and owner/dashboard safe. |
| 25 | Admin ViewPro | Tenant status and trial limits can be configured/enforced from admin. |
| 26 | Hardening piloto | Demo/template leftovers are cleaned, tests cover the full flow, and deploy readiness is explicit. |

## Stage 20 — Documentación end-to-end

**Goal:** close the document workflow promised by the original MVP.

Slices:

1. Owner document inbox in `/owner`.
2. Owner document upload using existing backend signed-url flow.
3. Internal document review UI from property detail or a task center.
4. Approve/reject/read submitted document versions.
5. Version/status/rejection visibility for both internal users and owners.
6. Production-ready storage adapter or explicit environment-backed adapter behind the existing storage port.
7. Seeded smoke: manager requests document → owner uploads → manager approves/rejects.

Acceptance criteria:

- No fake document URLs in production mode.
- Owner can only access requests linked to their active owner property links.
- Internal users can only review documents inside their tenant.
- Document activity appears in Seguimiento where already supported.
- Tests cover BFF, UI, permissions, and seeded happy path.

## Stage 21 — Invitaciones propietarios

**Goal:** remove owner seed/manual activation dependency.

Slices:

1. Generate owner invitation when linking an owner to a property.
2. Add invitation token and acceptance page.
3. Let new owners create credentials.
4. Let existing global owner users accept another agency/property link.
5. Support resend/revoke basics.
6. Emit owner invited/activated activity.

Acceptance criteria:

- Owner-only users can have zero tenant memberships.
- Active access comes from `PropertyAssetOwner` links.
- Revoked links remove owner access.
- No manual DB work is required to onboard an owner.

## Stage 22 — Equipo real

**Goal:** make the inmobiliaria self-operational with real managers and sellers.

Slices:

1. Replace mock app-new users routes/services.
2. Real team list from memberships/users.
3. Invite seller/manager.
4. Accept internal invite and create/login user.
5. Change role or deactivate access.
6. Enforce role permissions and trial user limits.

Acceptance criteria:

- Managers can assign existing active sellers to properties.
- Deactivated users cannot access tenant routes.
- Sellers only see assigned operational surfaces.
- No mock/in-memory user data is visible in production paths.

## Stage 23 — Comunicación

**Goal:** keep communication simple but real.

Slices:

1. Store/select tenant or seller WhatsApp contact number.
2. Replace owner `mailto:` fallback with prefilled WhatsApp link when a phone exists.
3. Include property and context in the message.
4. Emit `WHATSAPP_CONTACT_CLICKED` analytics/activity.
5. Keep WhatsApp Business API out of scope.

Acceptance criteria:

- Owners can contact the right agency/seller from property context.
- Contact clicks are measurable.
- If no phone exists, the UI shows a clear unavailable state instead of fake contact routes.

## Stage 24 — Notificaciones reales

**Goal:** make the notification center truthful.

Slices:

1. Add notification model/API.
2. Replace local/template notification store.
3. Notify internal users for document uploads, stale items, and relevant activity.
4. Notify owners for document requests, review results, and status updates.
5. Add read/unread and owner-safe/dashboard-safe filtering.

Acceptance criteria:

- Notification links point only to real accessible routes.
- Owner users never see dashboard-only notifications.
- Internal users never see cross-tenant notifications.
- Empty state is honest when no notifications exist.

## Stage 25 — Admin ViewPro

**Goal:** operate pilots without touching the database.

Slices:

1. Add tenant limit fields or a limit config model.
2. Admin can activate/suspend tenants.
3. Admin can configure property/user/storage limits.
4. Enforce limits on property creation, team invites, and document storage.
5. Add basic audit trail for admin changes.

Acceptance criteria:

- Suspended tenants cannot operate protected tenant workflows.
- Limit errors are clear and recoverable.
- Admin changes are auditable.

## Stage 26 — Hardening piloto

**Goal:** remove product-risk leftovers before real usage.

Slices:

1. Remove, redirect, or dev-gate unused template routes.
2. Stabilize demo seed assets and avoid brittle external image dependencies.
3. Add full seeded E2E: tenant login → property → seller → owner → documents → notifications/contact.
4. Add deployment/staging checklist.
5. Verify tenant isolation and owner isolation across the full workflow.

Acceptance criteria:

- There are no visible dead/demo routes in production navigation or direct access.
- Seeded smoke represents the real core workflow.
- Deploy verification is documented and repeatable.

## Review strategy

Keep each slice small enough for review:

- Prefer one PR per slice.
- Split any PR forecast over 400 changed lines.
- Every slice must include tests or an explicit reason why not.
- Run fresh review before pushing implementation PRs.

## Next step

Start with **Stage 20 — Documentación end-to-end**, because backend document capabilities already exist and the product cannot be called operational while document upload/review remains backend-only.

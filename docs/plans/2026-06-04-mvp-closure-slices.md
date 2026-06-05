# ViewPro MVP Closure Slices — Audited Status

This document is the operational plan for closing ViewPro as a **professional, usable MVP**. It is derived from the original product-final-like roadmap in `docs/plans/2026-05-28-mvp-product-final-like-roadmap-design.md` and from an evidence audit of current code/docs.

## Decision

Do not restart the roadmap. Continue from the original sequence, but update status based on what is already implemented.

The previous draft incorrectly proposed **Stage 20.6 — production document storage** as the next slice. Audit showed that S3/R2-compatible storage is already implemented, documented, and tested. This file corrects that.

## Rule of focus

Every new task must declare:

```txt
Stage:
Slice:
Objective:
Evidence needed:
Do not touch:
Done:
Next slice:
```

If a task does not move ViewPro closer to a real inmobiliaria operating without manual DB/support intervention, it goes to backlog.

## Current verified state

| Stage | Status | Evidence summary | Remaining gap |
| --- | --- | --- | --- |
| 20 — Documentación end-to-end | Mostly implemented | Owner inbox/upload, internal review, approve/reject/read, version/status/rejection visibility, S3/R2 storage, seeded smoke coverage | Confirm/document activity in Seguimiento and full regression evidence |
| 21 — Invitaciones propietarios | Mostly implemented | Owner invitation model/token/link, acceptance page, new owner activation, existing owner acceptance, manual link regeneration | Explicit revoke/resend UX; invited/activated activity evidence |
| 22 — Equipo real | Mostly implemented | Real team list, invitations, public acceptance, role update, deactivate, permissions | Trial/user limits and full E2E evidence |
| 23 — Comunicación | Partially complete | WhatsApp contact fields, owner property/movement contact links, click tracking | UI/config to edit phone/contact priority; final E2E evidence |
| 24 — Notificaciones reales | Mostly implemented | Internal/owner notification API, BFF, notification center, producers, read/unread | Full seeded E2E proving producers/routing/read state across roles |
| 25 — Admin ViewPro | Partially started | Admin read-only access/summary/tenants/activity exists | Tenant status writes, limits, enforcement, audit log, admin UI |
| 26 — Hardening piloto | Pending | Some isolation/tests exist | Full E2E, demo/template cleanup, deploy checklist, final pilot readiness |

## Evidence notes

### Stage 20 — Documentación

Implemented evidence:

- S3/R2 adapter exists: `viewpro-app/apps/api/src/documents/storage/s3-document-storage.adapter.ts`.
- Storage driver wiring and production S3 requirement: `viewpro-app/apps/api/src/documents/documents.module.ts`.
- S3/R2 env documentation: `viewpro-app/apps/api/.env.example`.
- Storage tests: `viewpro-app/apps/api/test/documents.storage.spec.ts`.
- Owner upload/use-case tests: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`.
- Seeded smoke covers owner upload and manager review: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`.

Remaining Stage 20 work should not be “build storage”. It should be either:

1. prove/document document activity in Seguimiento; or
2. run/extend full regression E2E if gaps remain.

### Stage 21 — Owner invitations

Implemented evidence:

- Owner invitation enum/model exists in Prisma.
- Owner invitation token helper exists.
- Linking an unregistered owner creates an invitation.
- Manual invitation link generation exists.
- Public owner invitation validation/acceptance exists.
- Acceptance UI exists in app-new.

Remaining:

- Existing owner accepting another agency/property is not done; current tests indicate registered-email conflict behavior.
- Explicit manager revoke/resend UX is partial/manual-link based.
- Owner invited/activated activity needs confirmation.

### Stage 22 — Team real

Implemented evidence:

- Team members endpoint exists.
- Team invitations create/list/resend/revoke exist.
- Public invitation acceptance exists.
- Role update and deactivate exist.
- Role permissions exist.

Remaining:

- User/trial limits are not done here.
- Need full E2E closure evidence for manager/seller/inactive behavior.

### Stage 23 — Communication

Implemented evidence:

- Tenant/user WhatsApp fields exist.
- Owner property and movement contact links exist.
- WhatsApp contact click tracking exists.

Remaining:

- UI/configuration to edit contact phone is not done.
- Contact priority rules need product confirmation/implementation.

### Stage 24 — Notifications

Implemented evidence:

- Internal notification API exists.
- Owner notification API exists.
- Read/unread support exists.
- Notification center supports dashboard/owner surfaces.
- Producers exist for document and status/movement events.

Remaining:

- Full seeded E2E should prove producers, routing isolation, and read/unread across owner/internal surfaces.

### Stage 25 — Admin ViewPro

Implemented evidence:

- Admin read-only summary/tenant/activity endpoints exist.
- Global admin guard exists.

Remaining:

- Tenant status write API.
- Admin UI for tenant status/limits.
- Property/user/storage/document limits.
- Enforcement of limits.
- Audit log for admin writes.

## Completed execution gates

### Slice 0.2 — Clean or classify loose artifacts

Completed. Temporary untracked artifacts were removed after review:

- `context/`
- `context.md`
- `reports/`
- `docs/plans/2026-06-02-stage-24-*.md`
- `viewpro-app/apps/api/prisma/migrations/20260603144100/`

Stage 24 notification architecture decisions were promoted into `docs/plans/2026-06-04-final-mvp-execution-plan.md` before deleting the temporary design docs. The orphan Prisma migration was deleted because it changed `document_requests.ownerUserId` FK behavior without a matching `schema.prisma` change.

### Slice 0.3 — Canonical docs classification

Completed. `docs/plans/README.md` now defines canonical vs historical docs and points to the current next slice.

### Slice 26.0 / 26.0a — Full MVP evidence audit and validation baseline unblock

Completed. Evidence report: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md`.

Green validation baseline:

- API `db:validate` — PASS.
- API `typecheck` — PASS.
- API tests — `46/46` files and `497/497` tests PASS.
- app-new tests — `70/70` files and `317/317` tests PASS.
- app-new `lint:strict` — PASS.
- seeded E2E — `6/6` tests PASS.

## Corrected next slice recommendation

### Completed: Stage 21.6 — Minimal owner invitation management

Stage 21.6 closed the remaining owner-invitation P0 for manager control over pending links without support/DB work. Managers can regenerate/copy a fresh pending link and explicitly revoke a pending link from the property owner card.

```txt
Stage: 21
Slice: 21.6 — Minimal owner invitation management
Objective: give managers a clear way to regenerate/resend-copy and revoke pending owner invite links.
Evidence needed: API/UI tests for regenerate and revoke; accepted/expired/revoked states remain safe.
Do not touch: email delivery automation or advanced invitation analytics.
Done: manager can regenerate/copy a fresh pending link and revoke a pending link without DB/support help.
Next slice: 25.1 — Admin tenant status write API + audit log.
```

### Completed: Stage 25.1 — Admin tenant status write API + audit log

Stage 25.1 closed the first ViewPro Admin operational control gap. ViewPro admins can now set tenants to `ACTIVE` or `SUSPENDED` through an admin-only backend endpoint. Real status changes write a `TENANT_STATUS_CHANGED` audit event atomically with the update, same-status writes are idempotent without duplicate audit, suspended tenants are blocked by the existing tenant guard, and concurrent duplicate writes are serialized by a tenant row lock.

```txt
Stage: 25
Slice: 25.1 — Admin tenant status write API + audit log
Objective: let ViewPro admins activate, suspend, and reactivate tenants without touching DB.
Evidence needed: API tests, global admin guard tests, tenant guard behavior, and audit record verification.
Do not touch: billing, limits, large admin UI, owner/team/document UI.
Done: admin can change tenant status; suspended tenant is blocked by existing guards; every status change is audited.
Next slice: 25.2 — Admin tenant management UI.
```

## Recommended sequence from here

1. **Implement Stage 25.2 Admin tenant management UI.**
2. **Implement Stage 25.3 Tenant limits model/API.**
3. **Implement Stage 25.4 Tenant limits enforcement.**
4. **Continue remaining P0/P1 closure:** WhatsApp config, notification E2E, Seguimiento document activity, team/seller evidence, final hardening, deploy checklist, final deck.

## Backlog outside immediate focus

- More visual refinements that do not block operation.
- Slides/deck before hardening is complete.
- WhatsApp Business API.
- Billing automation.
- Deep commercial automation.

## MVP ready definition

The MVP is ready when one inmobiliaria can:

1. register/login and operate in its tenant;
2. invite/manage real team members;
3. create/manage property engagements;
4. invite/link/activate owners without DB work;
5. publish follow-up movements/statuses;
6. request, receive, review, approve, and reject documents;
7. let owners read follow-up and respond to document requests;
8. use WhatsApp contact links with property context;
9. receive real in-app notifications for important events;
10. be controlled by ViewPro admin status/limits without DB edits;
11. pass a reproducible full seeded E2E.

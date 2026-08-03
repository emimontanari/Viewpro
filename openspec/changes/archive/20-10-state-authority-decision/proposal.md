# Proposal — Stage 20.10 State Change Request Workflow

**Status:** **proposed, ready to enter SDD `sdd-spec` after acceptance** — decision D1 resolved on 2026-06-14: beta ships with Cuenta Madre approval gating every official property state change. The audit reproduction was already neutralized at the API layer (gate `G1` confirmed `403 Forbidden`), so this slice formalizes the workflow rather than fixing a leak.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-2, product alignment 2026-06-14.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B (runs after `20.13` so the manager has movement outcomes as context when approving).

## Slice contract

```txt
Stage: 20
Slice: 20.10 — State change request workflow
Objective: let sellers request a property state change and let managers approve or reject it, so the official state only moves through a single gated path.
Evidence needed: API/BFF/UI/tests for seller request creation, manager approval/rejection, notification routing, idempotency, and tenant isolation.
Do not touch: custom workflow builder, custom statuses per agency, ProductForm redesign, 20.13 movement outcomes, or PropertyEngagementStatus enum values.
Done: a seller cannot mutate PropertyEngagement.status directly; managers see pending requests in a dedicated surface and approve/reject with a reason; approval atomically transitions the property state and records a STATUS_CHANGE movement; rejection notifies the seller without moving state.
Next slice: 24.5 — Notification routing E2E (the new request/approval notifications are folded into that proof).
```

## Problem

Today the API rejects seller-initiated `STATUS_CHANGE` movements with `403 Forbidden` (per gate `G1` evidence on 2026-06-14). That blocks the leak the audit reproduced, but it leaves the seller without a way to **ask** for a state change. In a real inmobiliaria the seller is closest to the activity (visits, offers, documentation) and naturally proposes when the property should move to the next stage. Without a request path the workflow stalls or moves outside the app (WhatsApp, calls), defeating the audit trail.

This slice closes the loop: the seller proposes, the manager (Cuenta Madre) approves or rejects, the official state only moves through that path, and every transition is auditable.

## Scope

- New table `StatusChangeRequest`:
  - `id` (uuid), `tenantId` (FK), `propertyEngagementId` (FK), `requestedByUserId` (FK), `requestedStatus` (`PropertyEngagementStatus`), `currentStatusSnapshot` (`PropertyEngagementStatus` — the property status at request time, used for stale-detection), `comment` (text, max 500), `status` (`PENDING | APPROVED | REJECTED | SUPERSEDED`), `resolvedByUserId` (FK, nullable), `resolvedAt` (datetime, nullable), `resolutionComment` (text, nullable, max 500), `createdAt`, `updatedAt`.
  - Indexes: `(tenantId, status, createdAt)`, `(propertyEngagementId, status)`.
  - Invariant: at most one `PENDING` request per `propertyEngagementId`. Enforced with a partial unique index where supported, plus a transactional check in the use case.
- API endpoints:
  - `POST /property-engagements/:id/status-change-requests` — seller (assigned only) creates a request. Body: `requestedStatus`, `comment?`. Returns the created request. Rejects if a pending request already exists for that property, or if `requestedStatus` equals the current status, or if the seller is not assigned to the property.
  - `GET /tenants/me/status-change-requests?status=PENDING` — manager bandeja, scoped to tenant, paginated.
  - `GET /property-engagements/:id/status-change-requests` — historic list for that property, visible to seller and manager.
  - `PATCH /status-change-requests/:id` — manager approves or rejects. Body: `decision: 'APPROVE' | 'REJECT'`, `resolutionComment?` (required when `REJECT`). On `APPROVE`, atomically: writes the new `PropertyEngagement.status`, creates a `Movement` of type `STATUS_CHANGE` with `previousStatus`/`newStatus`, marks the request `APPROVED`, and notifies the seller. On `REJECT`, marks the request `REJECTED` and notifies the seller; status is not touched.
  - Stale guard: on approve, if the property's current status no longer matches `currentStatusSnapshot`, the request is marked `SUPERSEDED` and approval is refused with a 409. The manager has to ask the seller to re-request from the current state.
- BFF:
  - `apps/app-new/src/app/api/products/[id]/status-change-requests/` POST + GET.
  - `apps/app-new/src/app/api/status-change-requests/` GET (manager bandeja) + PATCH.
- UI:
  - Property detail (seller side): if status mutation is blocked (no approved request pending), the existing status badge gains a small `Solicitar cambio` button. Click opens a modal with: target status dropdown, optional comment, submit. After submit, the badge shows a `Solicitud pendiente` chip.
  - Property detail (manager side): if a request is pending, the page shows an inline card "Solicitud de cambio de estado pendiente" with the seller, requested status, comment, and two buttons `Aprobar` and `Rechazar`. Reject requires a resolution comment.
  - Manager bandeja: new `/dashboard/status-change-requests` route lists all pending requests across properties. Each row links to the property detail.
- Notifications:
  - Notify the manager(s) when a seller creates a request. Type: `STATUS_CHANGE_REQUESTED` (new). Link: `/dashboard/product/<id>`.
  - Notify the seller when the request is approved or rejected. Types: `STATUS_CHANGE_APPROVED` and `STATUS_CHANGE_REJECTED` (new). Owner-facing links remain under `/owner...` per the canonical notification rules; these new types are internal-only and surface on the dashboard side.

## Permissions

- **Create request**: seller assigned to the property, or manager of the tenant.
- **List own requests / list per property**: seller assigned to the property, or manager.
- **Manager bandeja**: manager only.
- **Approve/reject**: manager only. A seller can never approve their own request, regardless of role; even if a seller had the manager role on the tenant for some edge reason, the use case rejects self-approval explicitly.

## Out of scope

- 20.13 movement outcomes (separate slice, runs first).
- Per-agency custom statuses or workflow builders.
- ProductForm redesign or any UI overhaul outside the bandeja and the inline pending card.
- Owner-facing notification about state changes (the existing owner timeline already reflects status via movements).
- Bulk approval, scheduled approval, escalation.
- Removing the API `403` guard — it stays; the workflow path is the only way to legitimately move state.

## Affected areas

- `viewpro-app/apps/api/prisma/schema.prisma` (new model + migration).
- `viewpro-app/apps/api/src/property-engagements/` (use case + endpoints, atomic approve transaction).
- `viewpro-app/apps/api/src/notifications/` (3 new notification types and producer wiring).
- `viewpro-app/apps/app-new/src/app/api/products/[id]/status-change-requests/` (new BFF routes).
- `viewpro-app/apps/app-new/src/app/api/status-change-requests/` (new BFF routes).
- `viewpro-app/apps/app-new/src/app/dashboard/status-change-requests/` (new manager bandeja page).
- `viewpro-app/apps/app-new/src/features/products/` (property detail integration on both seller and manager views).
- `viewpro-app/apps/api/scripts/seed-demo.mjs` (a couple of pending and resolved requests for the demo tenant so the bandeja is non-empty).
- Unit + integration + Playwright seeded smoke (new owner / seller / manager scenarios).

## Safety and integrity constraints

- Approval must be atomic: status update, movement insert, and request resolution happen inside a single transaction. If any step fails, the whole approval rolls back and the request remains `PENDING`.
- Concurrent approval guard: the use case takes a row-level lock on the property engagement during approval. Two managers cannot accept the same request.
- Self-approval is rejected even if the user has manager role and was the requester.
- Cross-tenant isolation: every query filters by tenant from the authenticated session; cross-tenant attempts return 404.
- Stale-state protection: if the property status has moved between request and approval, the request is marked `SUPERSEDED` and rejected with 409.
- Audit trail: the resulting `Movement` of type `STATUS_CHANGE` carries the seller as `createdByUserId` (the originator), and the resolution comment is stored on the request for posterity.

## Risks

- Bandeja fatigue. Mitigation: in MVP the manager only sees pending requests for tenants they manage. A future slice can add filters/sort.
- Race condition between approval and a parallel manual status edit (manager edits the status outside the request flow). Mitigation: in this slice the manual edit path is also gated by the same atomic transaction in the same use case; if needed, a follow-up adds full row-level locking.
- Notification spam if a seller spams requests. Mitigation: one `PENDING` per property invariant + idempotency on the seller side. A future slice can rate-limit.
- Migration complexity. The schema change is additive (one new table + 3 new notification enum values + indexes). No `Movement` or `PropertyEngagement` schema break.

## Rollback

Drop the new table, drop the new notification enum values, revert API/BFF/UI changes, revert seed additions. The API `403` guard remains independently of this slice, so rolling back this workflow simply restores the previous "seller cannot change state and has no path to ask" behavior. No data loss.

## Success criteria

- The seller cannot directly mutate `PropertyEngagement.status` (still 403 at the API), and now has a working request path through the UI.
- The manager bandeja lists pending requests for their tenant and can approve/reject them with a resolution comment.
- Approval atomically updates state, creates a `STATUS_CHANGE` movement, and notifies the seller. Rejection notifies the seller without changing state.
- Cross-tenant attempts return 404; self-approval is rejected; one pending per property is enforced; stale approvals are refused with 409.
- Seeded smoke includes: seller-creates-request → manager-approves → property-status-moved → seller-notified-and-can-read-resolution. Plus a parallel reject flow.
- Existing `403` guard remains in place; gate `G1` re-runs and stays green.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted, then `sdd-design` for the transactional approval design and the bandeja UX.

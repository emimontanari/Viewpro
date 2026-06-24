# Platform Back-Office (Super-Admin Console) — Vision

**Status:** vision / north-star — aligned 2026-06-24. Not an implementable change; it anchors the SDD slices below.

The platform back-office is the **operator console for the ViewPro/InmoView team**. It sits ABOVE every tenant and is used to run the SaaS itself: grant and revoke agency access, regulate each agency's limits according to what they pay, and see global metrics across all agencies. It is the most-privileged surface in the product — it deliberately crosses the tenant isolation that the rest of the app enforces.

This document is the compass. Each slice in the roadmap is planned and built via SDD and must stay consistent with the decisions here. When a slice wants to deviate, update this document first.

## What this is — and what it is NOT

| | |
|---|---|
| **IS** | The platform operator (ViewPro team) governing ALL agencies at once. |
| **IS NOT** | The "Cuenta Madre" — that is `TenantRole.PRINCIPAL_MANAGER`, the owner of ONE agency, scoped to their own tenant. |
| **IS** | Manual subscription plans = named presets of limits, assigned by hand. |
| **IS NOT** | A payment gateway. No Stripe/MercadoPago, no automated billing, no card handling. Money changes hands out-of-band. |
| **IS** | Adjusting per-tenant limits/quotas. |
| **IS NOT** | Per-tenant feature flags (turning modules on/off). Not chosen for now. |

Confusing the operator with the Cuenta Madre would break tenant isolation. Keep them separate at every layer.

## Foundation that already exists — EXTEND, do not rebuild

The data model was already designed for this. The work is to activate and surface it, not to invent it.

| Existing piece | Location | Role in the vision |
|---|---|---|
| `GlobalRole.VIEWPRO_ADMIN` | `User.globalRole` (prisma schema) | The platform operator identity (binary today). |
| `AdminModule` + `GlobalAdminGuard` | `apps/api/src/admin/` | Backend home + security boundary (already in production). |
| `/admin` page | `apps/app-new/src/app/admin/` | Frontend home for the console. |
| Live endpoints | `GET /admin/summary`, `GET /admin/tenants`, `GET /admin/activity`, `PATCH /admin/tenants/:id/status`, `PATCH /admin/tenants/:id/limits` | Metrics + tenant status + limits already work. |
| `Tenant.status` | `TRIAL / ACTIVE / SUSPENDED / CANCELLED` | Models grant/revoke access. |
| Tenant soft-limits | `maxUsers`, `maxActivePropertyEngagements`, `maxDocumentsStorageMb` | "Pay X for X people / properties". |

## Product decisions (locked)

| # | Decision |
|---|---|
| D1 | **Subscriptions = manual plans.** Plans/tiers are limit presets the team assigns by hand. No payment gateway. |
| D2 | **Tenant "permissions" = limits/quotas.** Adjust the existing caps and expose them in the UI. |
| D3 | **Audit log.** Every platform mutation (grant/revoke access, change limits, change plan) records who / what / when / old→new. Audit travels with the management actions — read-only metrics has nothing to audit. |
| D4 | **Internal platform roles are designed-for from day one, not all built on day one.** Mirror the existing tenant `PermissionGuard` + permissions pattern at the platform level. Do NOT hardcode `globalRole === VIEWPRO_ADMIN` across the code — route through a platform-permission layer so adding a role later is a data change, not a rewrite. |
| D5 | **Trial expires by CAP, not by clock.** No time-based expiry, no expiry jobs or reminder emails. When a trial agency hits a cap, they see "contract a plan". |
| D6 | **SUSPENDED ≠ CANCELLED.** Suspended = access cut, all data kept, reversible (missed payment). Cancelled = gone, data archived/deleted eventually. Treat them differently. |

## Onboarding state machine

```
self-registers → [TRIAL] → pays (out-of-band) + team approves → [ACTIVE]
                    │                                               │
              small caps:                                      stops paying
              2 users                                              ↓
              20 properties                              [SUSPENDED] ←→ pays again
              limited movements                                     ↓
                                                              leaves for good
                                                              [CANCELLED]
```

- Registration is **self-service**; the tenant starts in `TRIAL` with small caps.
- Trial → `ACTIVE` is a **manual** action by a platform admin after payment is confirmed out-of-band.
- Hitting a trial cap surfaces a soft block with a "contract a plan" call to action (capacity checks already exist in the repositories).

## Internal platform roles (future-facing, design only)

Today `VIEWPRO_ADMIN` is binary. As the team grows, roles will differentiate. The design must make these cheap to add later:

- **Owner / super-admin** — everything, including managing other admins.
- **Operations admin** — alta, suspend, limits, plans.
- **Analyst** — metrics only.
- *(later: support, management, etc.)*

Principle: design the seams now, build the roles when there are people to fill them.

## Roadmap — 4 chained slices

| Order | Slice | Scope | Notes |
|---:|---|---|---|
| 1 | **Global metrics panel** (read-only) | Extend `/admin`: totals + per-tenant breakdown of properties, people, movements, engagements. Add the missing `movement` count. | Low risk. Designed behind the platform-permission layer. **Start here.** |
| 2 | **Platform roles + tenant management + audit log** | Governance foundation: grant/revoke access, change limits, all audited, all behind platform permissions. | The "from the start" foundation from D3/D4. |
| 3 | **Self-service onboarding + trial** | Self-registration → `TRIAL` with cap-based limits (D5). | Reuses existing capacity checks. |
| 4 | **Manual plans** | Named limit presets (Básico / Pro / Enterprise) assigned by hand (D1). | Sugar over slice 2's limit editing. |

## Out of scope (explicitly, for now)

- Payment gateway / automated billing.
- Per-tenant feature flags.
- Time-based trial expiry and expiry jobs/emails.
- Tenant impersonation / accessing tenant document or movement contents from the console.

## Notable technical facts (verified)

- `PropertyAsset` has **no** `tenantId` — properties are shared, reached via `PropertyEngagement.tenantId`. Global property counts need a distinct `groupBy(propertyAssetId)` (the admin repo already does this).
- `movement` count is **not** in the current admin summary — trivial to add (the table has `tenantId`).
- The `/admin` route has client-side-only protection; the backend `GlobalAdminGuard` is the real security boundary. Any new platform mutation MUST be guarded server-side.

## Next step

Start **Slice 1 — Global metrics panel** via `sdd-new`. It reads this document as its anchor and must respect D2/D3/D4 (route through the platform-permission seam even though metrics is read-only).

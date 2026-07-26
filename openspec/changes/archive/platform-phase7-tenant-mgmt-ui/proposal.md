# Proposal: Platform Phase 7 Slice 2 — Sub-slice B — Operator Tenant-Management UI (viewpro-web)

**Change id**: `platform-phase7-tenant-mgmt-ui`
**Store**: `openspec/changes/platform-phase7-tenant-mgmt-ui/proposal.md` (+ Engram `sdd/platform-phase7-tenant-mgmt-ui/proposal`)
**Phase**: 7, slice 2, sub-slice B (frontend consumer of Sub-slice A's tenant registry + control endpoints).
**Grounded in**: explore #5801 (viewpro-web operator console); Sub-slice A proposal (`platform-phase7-tenant-registry`); verified API contract traced against viewpro-api source.

---

## 1. Intent

**Problem / why now.** Operators can already read tenant status via the metrics dashboard (Slice 1) and the backend now exposes a full tenant registry plus two control endpoints (Sub-slice A, merged). But there is **no console UI**: to suspend a tenant or change its limits an operator must hand-roll HTTP calls against viewpro-api. This is error-prone, undocumented, and unusable by non-engineers. Both PATCH endpoints are live and tested — the only missing piece is the operator-facing UI.

**Success.** An authenticated operator opens the tenant-management page, sees the paginated tenant list from `GET /operators/tenants`, suspends/activates any tenant, and edits its three limits — each mutation calling the existing PATCH endpoint and reflecting the confirmed result — without ever touching InmoView or writing raw HTTP.

---

## 2. Scope

### In scope
1. **Feature module** `apps/viewpro-web/src/features/tenants/`, mirroring Slice 1's `features/metrics/` exactly: `api/{types,service,queries}.ts` + `components/` + `__tests__`, using `apiRequest` from `src/lib/api-client.ts` directly (Design B, no BFF route — feature talks ONLY to viewpro-api).
2. **List view.** Plain shadcn `Table` + offset/limit pager (NOT the TanStack `data-table.tsx` — the API exposes no sort/filter params). Columns: name, slug, status, limits summary, actions.
3. **Status toggle.** ACTIVE↔SUSPENDED via `PATCH /operators/tenants/:id/status`; confirm-before-suspend UX; reflects the returned `{ status, unchanged, ... }`.
4. **Limits editor.** Raw `useState` form (mirror app-new's proven `LimitInput` pattern, NOT `@tanstack/react-form`) editing the 3 optional `number|null` fields via `PATCH /operators/tenants/:id/limits`; reflects returned `limits`.
5. **FE-owned response types.** Define `AdminTenant*UpdateResponse` types from the traced wire shapes; validate defensively. Do NOT import `@viewpro/platform-contract`'s `SetTenantStatusResult`/`SetTenantLimitsResult` (dead, misleading types).
6. **Nav entry** for the tenant-management page.
7. **Tests** in `__tests__` mirroring Slice 1's coverage (list render, status mutation, limits mutation, pending/disabled, error/404).

### Out of scope
- Single-tenant detail route (detail works off the list response only — there is no single-tenant GET).
- Any new/changed backend endpoint, migration, or event (reuse Sub-slice A verbatim).
- Search/filter/sort UI (API has no such params).
- The `VIEWPRO_ADMIN` role gate from app-new — stripped entirely (viewpro-web `Session` has no role; viewpro-api `AuthGuard` grants any authenticated operator full access).

## Capabilities

### New Capabilities
- `operator-tenant-management-ui`: the viewpro-web tenant list, status toggle, and limits editor consuming the existing `GET /operators/tenants` + the two PATCH endpoints.

### Modified Capabilities
- None (no backend/spec behavior changes; pure frontend consumer).

## 3. Approach & rationale

**Copy Slice 1's `features/metrics/` architecture verbatim** — a proven, reviewed pattern in this exact app — and swap the data layer for the tenants contract. `api/types.ts` owns FE-defined response types (the untyped `unknown` PATCH passthrough means the FE is the source of truth for shape); `api/service.ts` wraps `apiRequest`; `api/queries.ts` holds the TanStack Query list query + the two mutations (invalidate/refetch the list on success). Plain `Table` + offset/limit pager matches the paginated `{ total, items }` contract with no over-engineering. Raw-`useState` limits form avoids pulling in TanStack Form for a 3-field editor. Double-submit is guarded by disabling the action button while the mutation is pending (the idempotency key is per-call, not per-click).

## 4. Acceptance criteria

1. The page renders a paginated tenant list from `GET /operators/tenants?offset&limit` (`{ total, items }`), name ASC.
2. Offset/limit pager navigates pages; limit respects the API cap (200).
3. Status toggle calls `PATCH /operators/tenants/:id/status` with `{ status: 'ACTIVE'|'SUSPENDED' }` and reflects the returned `status`/`unchanged`.
4. Suspending a tenant requires an explicit confirm step before the PATCH fires.
5. Limits editor calls `PATCH /operators/tenants/:id/limits` with the 3 optional `number|null` fields and reflects the returned `limits`.
6. The action button is disabled while its mutation is pending (double-submit guard).
7. Errors are surfaced to the operator; a 404 (unknown tenant) shows a clear message rather than failing silently.
8. A new nav entry links to the tenant-management page.
9. The feature issues requests ONLY to viewpro-api (no InmoView, no BFF route).
10. FE response types are locally defined; the platform-contract result types are NOT imported.

## 5. Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/viewpro-web/src/features/tenants/api/{types,service,queries}.ts` | New | FE types, `apiRequest` service, TanStack Query list + 2 mutations |
| `apps/viewpro-web/src/features/tenants/components/` | New | Table + pager, status action (confirm), limits editor form |
| `apps/viewpro-web/src/features/tenants/__tests__/` | New | List/mutation/pending/error tests mirroring Slice 1 |
| viewpro-web routing + nav | Modified | New tenant-management page route + nav entry |

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — untyped `unknown` PATCH passthrough (viewpro-api types responses as `unknown`) | Med | FE owns `AdminTenant*UpdateResponse` types from traced shapes; validate defensively before reading fields. |
| R2 — misleading dead contract types (`SetTenantStatusResult`/`SetTenantLimitsResult` differ from the wire) | Med | Explicitly do NOT import them; encode the correct shapes in `api/types.ts` with a comment. |
| R3 — no single-tenant GET | Low | Detail/edit operate off the list-response row only; no fetch-by-id path. |
| R4 — double-submit (idempotency key is per-call, not per-click) | Med | Disable the action button while the mutation is pending. |
| R5 — accidental destructive suspend | Low | Confirm-before-suspend UX. |

## 7. Rollback

Pure additive frontend change on `feat/platform-foundation`. Rollback = revert the `features/tenants/` module + the nav/route entry. No migration, no backend, no data. Deploy risk is low; the track stays isolated on `feat/platform-foundation`.

## 8. Dependencies

- Sub-slice A (`platform-phase7-tenant-registry`) merged: `GET /operators/tenants` + both PATCH endpoints live (confirmed).
- Slice 1 `features/metrics/` present as the architecture template.

## 9. Open sub-questions for spec/design

1. Limits editor: inline row-expand vs modal dialog (app-new used a dialog).
2. Confirm-before-suspend: inline confirm vs `AlertDialog`; whether activate also confirms.
3. Optimistic update vs invalidate-and-refetch on mutation success (Slice 1 pattern to mirror).
4. Empty-state and error-state copy; pending-page skeleton vs spinner.
5. Nav placement/label relative to the metrics dashboard entry.

## 10. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.

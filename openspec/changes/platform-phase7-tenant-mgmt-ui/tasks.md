# Tasks: Platform Phase 7 Slice 2 Sub-slice B — OPERATOR TENANT-MANAGEMENT UI (viewpro-web)

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/apps/viewpro-web/`.
> Decisions D1–D16 (design.md) are LOCKED — do not reopen.
> FE-only change. No backend/spec-behavior change (Sub-slice A endpoints reused verbatim).

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| `<Toaster/>` mounted? (open item a) | **Already mounted.** `apps/viewpro-web/src/app/layout.tsx:66` renders `<Toaster />` inside `<Providers>`, imported from `@/components/ui/sonner`. No app-layout change needed — verified as an explicit early task (T-01), not assumed. |
| Nav icon key (open item b) | **`listDetails` already exists.** `apps/viewpro-web/src/components/icons.tsx:133` maps `listDetails: IconListDetails` (from `@tabler/icons-react`, already imported). No new icon key needs registering — verified as an explicit early task (T-02). |
| `PageContainer` prop names | Confirmed `pageTitle`/`pageDescription` via `app/dashboard/(overview)/page.tsx` — reuse verbatim (D16). |
| Page size | `limit=50` fixed client default (server caps at 200); no page-size selector (deferred, out of scope per proposal). |
| Reactivate vs activate | Single label derived from current status via `getTenantAction(row)` (copy app-new pattern) — no separate affordance. |
| pnpm filter name | Package name in `apps/viewpro-web/package.json` is **`viewpro-web`** (unscoped). Correct filter: `pnpm --filter viewpro-web <script>`. (`@viewpro/web` appears only in stale `docs/plans/*.md` — not the actual package name; do not use it.) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1 500–1 900 (7 new source files in `api/` + `components/`, 1 new route file, 1 nav-config edit, 5 new test files — full scope: list + status + limits, no BFF) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1: api layer + read-only list/pager/page) → PR 2 (WU-2: mutations — status confirm + limits dialog + nav) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | `features/tenants/api/{types,schemas,service,queries}.ts` + tests; read-only `tenants-table.tsx` (no actions column) + `tenants-pager.tsx` + `tenants-empty-state.tsx`; `tenants-management-page.tsx` (list query + loading/empty/error/pager only, no mutations); `app/dashboard/tenants/page.tsx` route (reachable by direct URL, **not yet linked from nav**) | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter viewpro-web test -- tenants` | Authenticated operator visits `/dashboard/tenants` directly → paginated tenant list renders (name/slug/status/limits), no action buttons | Delete `apps/viewpro-web/src/features/tenants/`, `apps/viewpro-web/src/app/dashboard/tenants/` — pure additive, zero risk to `features/metrics/` or app shell |
| WU-2 | Actions column on `tenants-table.tsx` (edit-limits + status toggle); `tenant-limits-dialog.tsx` (new); `tenant-status-confirm-dialog.tsx` (new); mutation wiring + dialog state on `tenants-management-page.tsx`; `config/nav-config.ts` entry (page becomes discoverable) | PR 2 (base: PR 1 branch) | `pnpm --filter viewpro-web test -- tenants` | Operator suspends a tenant (confirm gate), edits its limits (modal), sees `unchanged` handled gracefully, list refetches on success | Revert the `nav-config.ts` line; revert the actions-column + mutation hunks in `tenants-table.tsx` / `tenants-management-page.tsx`; delete `tenant-limits-dialog.tsx` + `tenant-status-confirm-dialog.tsx`. PR 1's read-only page stays intact and unlinked |

---

## Dependency Graph

```
T-01 (verify: <Toaster/> mounted in app/layout.tsx — open item a)
T-02 (verify: nav icon `listDetails` exists in Icons map — open item b)
  [T-01, T-02 are independent verification checks — no shared files, may run in parallel;
   both must complete before the TDD chain below since they gate the "no extra plumbing needed" assumption]

T-03 (RED: api layer — types/schemas/service/queries unit tests, tenants-api.spec.ts)
  └── T-04 (GREEN: api/types.ts + api/schemas.ts + api/service.ts + api/queries.ts)
        └── T-05 (RED: tenants-table.spec.tsx — read-only rendering)
              └── T-06 (GREEN: tenants-table.tsx read-only + tenants-pager.tsx + tenants-empty-state.tsx)
                    └── T-07 (RED: tenants-management-page.spec.tsx — loading/empty/error/success/pager, PR1 subset)
                          └── T-08 (GREEN: tenants-management-page.tsx — list query + pager wiring, no mutations)
                                └── T-09 (RED: app/dashboard/tenants/__tests__/page.spec.tsx)
                                      └── T-10 (GREEN: app/dashboard/tenants/page.tsx)
                                            └── T-11 (WU-1 verification — PR1 boundary)
                                                  └── T-12 (RED: tenants-table.spec.tsx — actions column + isMutating)
                                                        └── T-13 (GREEN: tenants-table.tsx actions column)
                                                              └── T-14 (RED: tenant-limits-dialog.spec.tsx)
                                                                    └── T-15 (GREEN: tenant-limits-dialog.tsx)
                                                                          └── T-16 (RED: tenants-management-page.spec.tsx — mutations/confirm/unchanged/404, PR2 additions)
                                                                                └── T-17 (GREEN: tenants-management-page.tsx mutations + tenant-status-confirm-dialog.tsx)
                                                                                      └── T-18 (nav-config.ts — add Inquilinos entry)
                                                                                            └── T-19 (final verification — full suite + typecheck + build + isolation)
```

Sequential rationale: the module is built strictly bottom-up (types/schemas → service → queries → presentational components → container → route → nav), and every layer's test file imports the layer below it, so parallelizing across layers would leave RED tests failing on missing imports rather than on missing behavior. Within WU-1 and WU-2 the chain is intentionally linear — the only true parallel opportunity is T-01/T-02 (verification, no code dependency).

---

## WU-1 — api layer + read-only list/pager/page (PR 1)

### [x] T-01 — Verify `<Toaster/>` is mounted in the app layout (open item a)
**Type**: verify
**Spec**: N/A (infrastructure prerequisite for toast-based success/error/`unchanged` messaging in Requirements 2, 3, 5)
**WU**: WU-1, commit 1
**Depends on**: nothing

- Inspect `apps/viewpro-web/src/app/layout.tsx`: confirm `<Toaster />` (from `@/components/ui/sonner`) is rendered inside the tree (currently at line 66, inside `<Providers>`).
- If absent, add `<Toaster />` to `layout.tsx` as part of this task. (Verified present — no code change required for this change.)

**Exit**: `rg "Toaster" apps/viewpro-web/src/app/layout.tsx` shows the component rendered (not just imported).
**Commit**: `chore(web): verify Toaster is mounted in app layout (no-op, tenant-mgmt-ui prep)`

---

### [x] T-02 — Verify/confirm the nav icon key for the tenant-management entry (open item b)
**Type**: verify
**Spec**: N/A (prerequisite for T-18 nav wiring)
**WU**: WU-1, commit 2
**Depends on**: nothing

- Inspect `apps/viewpro-web/src/components/icons.tsx`: confirm `listDetails: IconListDetails` exists in the `Icons` map (currently line 133).
- If a more tenant/building-specific glyph is preferred over `listDetails`, register a new key here now (small additive change) and use it in T-18. (Verified `listDetails` present and adequate — no new icon key required.)

**Exit**: `rg "listDetails" apps/viewpro-web/src/components/icons.tsx` shows the key defined.
**Commit**: `chore(web): confirm listDetails nav icon key (no-op, tenant-mgmt-ui prep)`

---

### [x] T-03 — RED: api layer unit tests — types, zod schemas, service, queries
**Type**: test (RED)
**Spec**: Paginated Tenant List (scenarios 1, 3); Status Toggle with Suspend Confirmation (PATCH body shape); Limits Editing via Modal Dialog (PATCH body shape); viewpro-api-Only Isolation (all requests via `apiRequest`)
**WU**: WU-1, commit 3
**Depends on**: T-01, T-02

- Create `apps/viewpro-web/src/features/tenants/api/__tests__/tenants-api.spec.ts` (vitest, mocking `@/lib/api-client` per `metrics.spec.ts` precedent):
  - `getTenantList(offset, limit)` calls `GET /operators/tenants?offset=<offset>&limit=<limit>`; returns `{ total, items }` typed `TenantListResponse`
  - `updateTenantStatus(id, { status })` calls `PATCH /operators/tenants/:id/status` with body `{ status }`
  - `updateTenantLimits(id, limits)` calls `PATCH /operators/tenants/:id/limits` with body = the 3-field limits object
  - `parseStatusResponse(raw)` accepts the traced shape (`{tenantId,previousStatus,status,unchanged,updatedAt}`) and returns it typed; rejects `{}` / wrong-typed fields / `null` by throwing a `{status:502,...}`-shaped error (no field read unvalidated)
  - `parseLimitsResponse(raw)` — symmetric, over the limits response shape
  - `tenantsKeys.all === ['tenants']`; `tenantsKeys.list(offset,limit) === ['tenants','list',offset,limit]` (stable)
  - `tenantsListOptions(offset,limit)` carries `queryKey: tenantsKeys.list(offset,limit)` and a `queryFn` delegating to `getTenantList`
  - Isolation assertion: every service call goes through the mocked `apiRequest` (no `fetch` called directly, no import of `@viewpro/platform-contract`)

All RED until T-04 (no implementation exists yet).
**Exit**: test file exists; `pnpm --filter viewpro-web test -- tenants-api` fails (missing modules / all assertions red).
**Commit**: `test(web): RED — tenants api layer (types/schemas/service/queries)`

---

### [x] T-04 — GREEN: implement `api/types.ts` + `api/schemas.ts` + `api/service.ts` + `api/queries.ts`
**Type**: impl
**Spec**: Paginated Tenant List; Status Toggle with Suspend Confirmation; Limits Editing via Modal Dialog; viewpro-api-Only Isolation
**WU**: WU-1, commit 4
**Depends on**: T-03

- `apps/viewpro-web/src/features/tenants/api/types.ts`: `TenantStatus`, `TenantStatusAction`, `TenantLimits`, `TenantListItem`, `TenantListResponse`, `UpdateTenantStatusPayload`, `UpdateTenantLimitsPayload`, `AdminTenantStatusUpdateResponse`, `AdminTenantLimitsUpdateResponse` — per design.md Interfaces/Contracts §. Comment: do NOT import `@viewpro/platform-contract` `SetTenant*Result` (D3).
- `apps/viewpro-web/src/features/tenants/api/schemas.ts`: zod `limitsSchema`, `statusResponseSchema`, `limitsResponseSchema`, `parseStatusResponse(raw: unknown)`, `parseLimitsResponse(raw: unknown)` — `safeParse` + throw normalized `{status:502, message:'Respuesta inesperada del servidor.'}` on failure (D4).
- `apps/viewpro-web/src/features/tenants/api/service.ts`: `getTenantList`, `updateTenantStatus`, `updateTenantLimits` — all via `apiRequest` (Design B, D2); PATCH calls set `method:'PATCH'`, `body`; PATCH responses fetched as `apiRequest<unknown>` then parsed via the schemas.
- `apps/viewpro-web/src/features/tenants/api/queries.ts`: `tenantsKeys`, `tenantsListOptions(offset,limit)` (`queryOptions`, D13).
- Confirm T-03 GREEN.

**Exit**: `pnpm --filter viewpro-web test -- tenants-api` — T-03 GREEN; `pnpm --filter viewpro-web run typecheck` passes.
**Commit**: `feat(web): tenants api layer — types, zod schemas, service, queries`

---

### [x] T-05 — RED: `tenants-table.spec.tsx` — read-only rendering
**Type**: test (RED)
**Spec**: Paginated Tenant List (scenario 1: renders name/slug/status/limits, name ASC)
**WU**: WU-1, commit 5
**Depends on**: T-04

- Create `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-table.spec.tsx`:
  - Given `items: TenantListItem[]`, renders one row per item with name, slug, status badge, limits summary (3 values, "Sin límite" for `null`)
  - Renders rows in the order received (no client re-sort — server already sorts name ASC)
  - No actions column / no buttons rendered yet at this stage (PR1 read-only scope)

All RED until T-06.
**Exit**: test file exists; `pnpm --filter viewpro-web test -- tenants-table` fails (component doesn't exist).
**Commit**: `test(web): RED — tenants-table read-only rendering`

---

### [x] T-06 — GREEN: `tenants-table.tsx` (read-only) + `tenants-pager.tsx` + `tenants-empty-state.tsx`
**Type**: impl
**Spec**: Paginated Tenant List (scenarios 1, 2, 4)
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/viewpro-web/src/features/tenants/components/tenants-table.tsx`: plain shadcn `Table`, columns name/slug/status badge/limits summary. No actions column yet (added in T-13).
- `apps/viewpro-web/src/features/tenants/components/tenants-pager.tsx`: offset/limit pager — prev/next + "mostrando X–Y de total"; `onNext` computed/guarded by the caller (container owns the guard per D13); `limit` fixed, never requested above 200 (D5, invariant).
- `apps/viewpro-web/src/features/tenants/components/tenants-empty-state.tsx`: copy-mirrors `metrics-empty-state.tsx` — rendered when `total===0`.
- Confirm T-05 GREEN.

**Exit**: `pnpm --filter viewpro-web test -- tenants-table` — T-05 GREEN.
**Commit**: `feat(web): tenants-table (read-only) + tenants-pager + tenants-empty-state`

---

### [x] T-07 — RED: `tenants-management-page.spec.tsx` — loading/empty/error/success/pager (PR1 subset)
**Type**: test (RED)
**Spec**: Paginated Tenant List (all 4 scenarios); Error Handling (generic list-load failure)
**WU**: WU-1, commit 7
**Depends on**: T-06

- Create `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-management-page.spec.tsx` (mirrors dashboard `page.spec.tsx` mocking pattern — mock `@/features/tenants/api/queries` and `@/features/tenants/api/service`):
  - Loading → skeleton (not an error)
  - Success with `total>0` → `<TenantsTable/>` + `<TenantsPager/>` rendered
  - Success with `total===0` → `<TenantsEmptyState/>` rendered instead of the table
  - Error (non-401) → inline error card via `getApiErrorMessage`
  - Clicking "next page" issues a new query with an increased `offset`; requested `limit` never exceeds 200

All RED until T-08.
**Exit**: test file exists; `pnpm --filter viewpro-web test -- tenants-management-page` fails.
**Commit**: `test(web): RED — tenants-management-page list/loading/empty/error/pager`

---

### [ ] T-08 — GREEN: `tenants-management-page.tsx` — list query + pager wiring (no mutations)
**Type**: impl
**Spec**: Paginated Tenant List (all 4 scenarios); Error Handling (list load)
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx` (container, D12): `useState` for `offset` (default 0) / `limit` (fixed 50); `useQuery(tenantsListOptions(offset, limit))`; branch loading → skeleton, error → error card (`getApiErrorMessage`), `total===0` → `<TenantsEmptyState/>`, else → `<TenantsTable items=.../>` + `<TenantsPager .../>`.
- No mutation state yet (`statusMutation`/`limitsMutation`/dialogs added in T-17).
- Confirm T-07 GREEN.

**Exit**: `pnpm --filter viewpro-web test -- tenants-management-page` — T-07 GREEN.
**Commit**: `feat(web): tenants-management-page — list query + loading/empty/error/pager`

---

### [ ] T-09 — RED: `app/dashboard/tenants/__tests__/page.spec.tsx`
**Type**: test (RED)
**Spec**: Paginated Tenant List (page reachability, scenario 1)
**WU**: WU-1, commit 9
**Depends on**: T-08

- Create `apps/viewpro-web/src/app/dashboard/tenants/__tests__/page.spec.tsx` (mirrors metrics dashboard `page.spec.tsx`): asserts the route renders `<TenantsManagementPage/>` inside `<PageContainer pageTitle="Inquilinos" .../>`.

All RED until T-10.
**Exit**: test file exists; fails (route file doesn't exist).
**Commit**: `test(web): RED — /dashboard/tenants route renders TenantsManagementPage`

---

### [ ] T-10 — GREEN: `app/dashboard/tenants/page.tsx`
**Type**: impl
**Spec**: Paginated Tenant List (page reachability)
**WU**: WU-1, commit 10
**Depends on**: T-09

- `apps/viewpro-web/src/app/dashboard/tenants/page.tsx`: thin `'use client'` route — `<PageContainer pageTitle='Inquilinos' pageDescription='...'><TenantsManagementPage/></PageContainer>` (D16). Not yet linked from `nav-config.ts` (T-18, WU-2) — reachable only by direct URL in PR1.
- Confirm T-09 GREEN.

**Exit**: `pnpm --filter viewpro-web test -- dashboard/tenants` — T-09 GREEN.
**Commit**: `feat(web): /dashboard/tenants route (thin, unlinked pending WU-2 nav entry)`

---

### [ ] T-11 — WU-1 verification (PR1 boundary)
**Type**: verify
**Spec**: Paginated Tenant List (all 4 scenarios); Error Handling (list load); viewpro-api-Only Isolation
**WU**: WU-1, commit 11
**Depends on**: T-10

- `pnpm --filter viewpro-web test -- tenants` — all GREEN (api, table, pager/empty-state via container test, management-page, route)
- `pnpm --filter viewpro-web run typecheck` — passes
- `rg '@viewpro/platform-contract' apps/viewpro-web/src/features/tenants/` — zero hits (D3/D10 isolation)
- `rg "apiRequest" apps/viewpro-web/src/features/tenants/api/service.ts` — every network call goes through `apiRequest` (no raw `fetch`)
- Manual/CI harness note: authenticated operator visiting `/dashboard/tenants` directly sees the paginated list; the page is not yet reachable from the sidebar (nav entry is WU-2)

**Exit**: all above checks pass; no regressions in `features/metrics/`.
**Commit**: `chore(web): WU-1 verification — read-only tenant list PR boundary`

---

## WU-2 — mutations: status confirm + limits dialog + nav (PR 2)

### [ ] T-12 — RED: `tenants-table.spec.tsx` — actions column + `isMutating` guard
**Type**: test (RED)
**Spec**: Status Toggle with Suspend Confirmation (button present); Limits Editing via Modal Dialog (edit-limits button present); Double-Submit Guard
**WU**: WU-2, commit 1
**Depends on**: T-11

- Extend `tenants-table.spec.tsx`:
  - Renders an "Editar límites" button per row → emits `onEditLimits(row)` on click
  - Renders a status-action button per row, label derived from current status (`getTenantAction`) — "Suspender" for ACTIVE, "Activar"/"Reactivar" for TRIAL/SUSPENDED, no button for CANCELLED → emits `onToggleStatus(row)` on click
  - `isMutating={true}` disables both buttons on every row (double-submit guard, AC6)

All new assertions RED until T-13.
**Exit**: new assertions fail; T-05's read-only assertions remain GREEN (regression).
**Commit**: `test(web): RED — tenants-table actions column + isMutating disables buttons`

---

### [ ] T-13 — GREEN: `tenants-table.tsx` — add actions column
**Type**: impl
**Spec**: Status Toggle with Suspend Confirmation; Limits Editing via Modal Dialog; Double-Submit Guard
**WU**: WU-2, commit 2
**Depends on**: T-12

- Extend `tenants-table.tsx`: add an actions column with the edit-limits button (`onEditLimits`) and the status-toggle button (`onToggleStatus`, label via `getTenantAction`), both `disabled={isMutating}`.
- `getTenantAction(row)` helper (copy app-new pattern, D14): TRIAL/SUSPENDED → target ACTIVE; ACTIVE → target SUSPENDED; CANCELLED → no action (button omitted).
- Confirm T-12 GREEN; T-05's assertions still GREEN.

**Exit**: `pnpm --filter viewpro-web test -- tenants-table` — T-12 GREEN; no regression.
**Commit**: `feat(web): tenants-table actions column — edit limits + status toggle (D14)`

---

### [ ] T-14 — RED: `tenant-limits-dialog.spec.tsx`
**Type**: test (RED)
**Spec**: Limits Editing via Modal Dialog (all 3 scenarios)
**WU**: WU-2, commit 3
**Depends on**: T-13

- Create `apps/viewpro-web/src/features/tenants/components/__tests__/tenant-limits-dialog.spec.tsx`:
  - Given `tenant` with `limits`, the modal opens pre-filled with the 3 current values (`useEffect([tenant])` seed)
  - Clicking "Sin límite" on a field clears it to empty string
  - Submitting emits `onSave` with the parsed payload — empty field → `null`, numeric string → `Number(...)`
  - `isSaving={true}` disables the save button

All RED until T-15.
**Exit**: test file exists; fails.
**Commit**: `test(web): RED — tenant-limits-dialog seed/clear/submit/pending`

---

### [ ] T-15 — GREEN: `tenant-limits-dialog.tsx`
**Type**: impl
**Spec**: Limits Editing via Modal Dialog (all 3 scenarios)
**WU**: WU-2, commit 4
**Depends on**: T-14

- `apps/viewpro-web/src/features/tenants/components/tenant-limits-dialog.tsx`: modal `Dialog` + raw-`useState<Record<keyof TenantLimits,string>>` form + `LimitInput` (copy app-new `LimitInput`/`parseLimitInputValue`/`isLimitInputValueAllowed`, D6). Seeds via `useEffect(...,[tenant])`; "Sin límite" → `''`; submit calls `onSave({...parsed})`; save button `disabled={isSaving}`.
- Confirm T-14 GREEN.

**Exit**: `pnpm --filter viewpro-web test -- tenant-limits-dialog` — T-14 GREEN.
**Commit**: `feat(web): tenant-limits-dialog — modal form + LimitInput (D6/D7)`

---

### [ ] T-16 — RED: `tenants-management-page.spec.tsx` — mutations, suspend confirm, unchanged, 404
**Type**: test (RED)
**Spec**: Status Toggle with Suspend Confirmation (all 4 scenarios); Limits Editing via Modal Dialog (scenarios 2, 3); Double-Submit Guard; Error Handling (both scenarios)
**WU**: WU-2, commit 5
**Depends on**: T-15

- Extend `tenants-management-page.spec.tsx`:
  - Clicking the status button on an ACTIVE row opens `<TenantStatusConfirmDialog/>` (AlertDialog) and does NOT call `updateTenantStatus` yet
  - Confirming the dialog calls `PATCH .../status` with `{status:'SUSPENDED'}`
  - Clicking the status button on a SUSPENDED/TRIAL row calls `PATCH .../status` with `{status:'ACTIVE'}` directly, no confirm dialog
  - On mutation success: `invalidateQueries`/refetch is called and the dialog closes
  - `unchanged:true` in the response → info toast, no error, list still refetched
  - Clicking "Editar límites" opens `<TenantLimitsDialog/>`; submitting calls `PATCH .../limits` with the edited fields; success closes the dialog and refetches
  - 404 on either mutation → a clear "no existe" message shown; the list is left unchanged (no partial state)
  - Generic (500) mutation failure → error surfaced, page stays interactive, list retains its pre-failure data
  - The triggering button (confirm action / dialog save) is `disabled` for the duration of its mutation (double-submit guard)

All new assertions RED until T-17.
**Exit**: new assertions fail; all WU-1 assertions in this file remain GREEN (regression).
**Commit**: `test(web): RED — tenants-management-page mutations, suspend confirm, unchanged, 404`

---

### [ ] T-17 — GREEN: `tenants-management-page.tsx` mutations + `tenant-status-confirm-dialog.tsx`
**Type**: impl
**Spec**: Status Toggle with Suspend Confirmation; Limits Editing via Modal Dialog; Double-Submit Guard; Error Handling; viewpro-api-Only Isolation
**WU**: WU-2, commit 6
**Depends on**: T-16

- `apps/viewpro-web/src/features/tenants/components/tenant-status-confirm-dialog.tsx`: `AlertDialog` confirm, shown only for the SUSPEND transition (D8); confirm button `disabled` while pending.
- Extend `tenants-management-page.tsx`: `statusMutation` + `limitsMutation` (`useMutation`, D9) — `onSuccess` inspects `unchanged` (toast.info vs toast.success), invalidates `tenantsKeys.list(...)`, closes the active dialog; `onError` — `isApiError(e) && e.status===404` → "El inquilino no existe o fue eliminado.", else `getApiErrorMessage(e)` toast. Dialog state (`pendingAction`, `limitsTenant`) drives `TenantStatusConfirmDialog`/`TenantLimitsDialog` visibility. `getTenantAction(row)` routes ACTIVE→confirm-then-SUSPEND, TRIAL/SUSPENDED→ACTIVE-direct (D8).
- Confirm T-16 GREEN; WU-1 assertions in the same spec file remain GREEN (regression).

**Exit**: `pnpm --filter viewpro-web test -- tenants-management-page` — T-16 GREEN; full `tenants` suite GREEN.
**Commit**: `feat(web): tenants-management-page mutations + tenant-status-confirm-dialog (D8/D9/D11/D15)`

---

### [ ] T-18 — Nav: add "Inquilinos" entry to `config/nav-config.ts`
**Type**: impl (mechanical, no RED required — additive config data, no new branching logic)
**Spec**: Paginated Tenant List (page discoverability, proposal AC8)
**WU**: WU-2, commit 7
**Depends on**: T-17

- In `apps/viewpro-web/src/config/nav-config.ts`, add to the `Operaciones` group:
  ```ts
  { title: 'Inquilinos', url: '/dashboard/tenants', icon: 'listDetails', isActive: false, items: [] }
  ```
  (icon key confirmed present in T-02 — no `icons.tsx` change).
- Confirm `tenants-management-page.spec.tsx` / route test unaffected (regression).

**Exit**: `pnpm --filter viewpro-web run typecheck` passes; `rg "Inquilinos" apps/viewpro-web/src/config/nav-config.ts` shows the entry.
**Commit**: `feat(web): add Inquilinos nav entry → /dashboard/tenants (D16)`

---

### [ ] T-19 — Final verification: full suite, typecheck, build, isolation
**Type**: verify
**Spec**: All 6 requirements + all invariants; proposal acceptance criteria 1–10
**WU**: WU-2, commit 8
**Depends on**: T-18

**Final verification checklist**:
1. `pnpm --filter viewpro-web test` — all GREEN (full suite, incl. pre-existing `features/metrics/` — no regression)
2. `pnpm --filter viewpro-web run typecheck` — passes
3. `pnpm --filter viewpro-web run build` — passes (Next.js production build)
4. `rg '@viewpro/platform-contract' apps/viewpro-web/src/features/tenants/` — zero hits (D3, AC10)
5. `rg 'apiRequest' apps/viewpro-web/src/features/tenants/api/service.ts` — every list/status/limits call goes through `apiRequest`; `rg "fetch\\(" apps/viewpro-web/src/features/tenants/` shows no direct `fetch` calls (AC9, isolation)
6. `rg 'globalRole|VIEWPRO_ADMIN|isAdmin' apps/viewpro-web/src/features/tenants/` — zero hits (D10 — role gate stripped, no action hidden by role)
7. Confirm `limit` sent to `GET /operators/tenants` never exceeds 200 (pager test + manual check of `tenantsListOptions` default)
8. Confirm the acting button (row action / AlertDialog confirm / dialog save) is `disabled` for the full duration of its mutation in all three surfaces (double-submit guard, invariant)
9. Confirm SUSPEND always confirmed, ACTIVATE never confirmed (invariant)
10. `git diff HEAD -- apps/viewpro-web/src/features/metrics/` — no unintended regressions in Slice 1
11. `git diff HEAD -- apps/viewpro-web/src/app/layout.tsx` — no diff (T-01 confirmed `<Toaster/>` pre-existing) or, if a diff exists, confirm it is exactly the `<Toaster/>` addition
12. Confirm `apps/viewpro-web/src/app/dashboard/tenants/page.tsx` is reachable via the new `nav-config.ts` entry end-to-end

**Exit**: all 12 checks pass; no regressions.
**Commit**: `chore(web): platform-phase7-tenant-mgmt-ui — final verification`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-01 verify Toaster mounted | verify | WU-1 | infra prerequisite (open item a) | — |
| T-02 verify nav icon key | verify | WU-1 | infra prerequisite (open item b) | — |
| T-03 RED: api layer tests | test | WU-1 | Paginated Tenant List; Status/Limits PATCH shapes; Isolation | T-01, T-02 |
| T-04 GREEN: api layer impl | impl | WU-1 | Paginated Tenant List; Status/Limits PATCH shapes; Isolation | T-03 |
| T-05 RED: table read-only tests | test | WU-1 | Paginated Tenant List (scenario 1) | T-04 |
| T-06 GREEN: table/pager/empty-state | impl | WU-1 | Paginated Tenant List (scenarios 1, 2, 4) | T-05 |
| T-07 RED: management-page list tests | test | WU-1 | Paginated Tenant List (all 4); Error Handling (list) | T-06 |
| T-08 GREEN: management-page list wiring | impl | WU-1 | Paginated Tenant List (all 4); Error Handling (list) | T-07 |
| T-09 RED: route page test | test | WU-1 | Paginated Tenant List (reachability) | T-08 |
| T-10 GREEN: route page | impl | WU-1 | Paginated Tenant List (reachability) | T-09 |
| T-11 WU-1 verification (PR1 boundary) | verify | WU-1 | All list/pager/error scenarios; Isolation | T-10 |
| T-12 RED: table actions-column tests | test | WU-2 | Status Toggle; Limits Editing; Double-Submit Guard | T-11 |
| T-13 GREEN: table actions column | impl | WU-2 | Status Toggle; Limits Editing; Double-Submit Guard | T-12 |
| T-14 RED: limits-dialog tests | test | WU-2 | Limits Editing via Modal Dialog (all 3) | T-13 |
| T-15 GREEN: limits-dialog impl | impl | WU-2 | Limits Editing via Modal Dialog (all 3) | T-14 |
| T-16 RED: management-page mutation tests | test | WU-2 | Status Toggle (all 4); Limits Editing (2,3); Double-Submit Guard; Error Handling (both) | T-15 |
| T-17 GREEN: management-page mutations + confirm dialog | impl | WU-2 | Status Toggle; Limits Editing; Double-Submit Guard; Error Handling; Isolation | T-16 |
| T-18 nav-config.ts entry | impl | WU-2 | Page discoverability (AC8) | T-17 |
| T-19 Final verification | verify | WU-2 | All requirements + invariants + AC1–10 | T-18 |

---

## Success Checklist (maps to spec acceptance criteria)

- [ ] Tenant list renders from `GET /operators/tenants?offset&limit` (`{total,items}`), name ASC (T-05, T-06, T-07, T-08)
- [ ] Pager navigates offset/limit pages; requested `limit` never exceeds 200 (T-06, T-07, T-08, T-19)
- [ ] Empty registry (`total===0`) shows an empty-state instead of a table row (T-06, T-07, T-08)
- [ ] Suspend requires an explicit confirmation step before `PATCH .../status` fires; Activate PATCHes directly (T-16, T-17)
- [ ] `unchanged:true` on a status/limits mutation handled gracefully — no error, list still reflects the returned value (T-16, T-17)
- [ ] List is invalidated and refetched (never patched optimistically) after a successful status or limits mutation (T-16, T-17)
- [ ] Limits modal opens pre-filled from the row; clearing a field sends `null`; save PATCHes and refreshes the list (T-14, T-15, T-16, T-17)
- [ ] The acting button for any in-flight mutation is disabled until it settles (T-12, T-13, T-14, T-15, T-16, T-17)
- [ ] 404 on a mutation shows a clear "no existe" message; the list stays unchanged (T-16, T-17)
- [ ] Generic (500) mutation failure surfaces an error without crashing the page; list retains pre-failure data (T-16, T-17)
- [ ] Every request goes through `apiRequest` to viewpro-api only — no BFF route, no InmoView call (T-03, T-04, T-19)
- [ ] No role-based hiding of any list/status/limits action (T-13, T-17, T-19 — `globalRole`/`isAdmin` grep is empty)
- [ ] FE-owned response types (`AdminTenant{Status,Limits}UpdateResponse`) are locally defined; `@viewpro/platform-contract` `SetTenant*Result` is NOT imported (T-04, T-19)
- [ ] New nav entry links to the tenant-management page (T-18, T-19)
- [ ] Full `pnpm --filter viewpro-web test` + `typecheck` + `build` green with no regressions in `features/metrics/` (T-19)

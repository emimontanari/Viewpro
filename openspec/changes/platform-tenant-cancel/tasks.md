# Tasks: Tenant CANCELLED lifecycle (vision D6)

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Locked architecture (D1–D8 in design.md) — do not reopen.

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| `terminal` result variant fields | Carries `tenantId`, `currentStatus`, `updatedAt` — symmetric with `unchanged` (design open question, resolved yes) |
| FE action/callback wiring | `getTenantActions(item): TenantAction[]` where `TenantAction = { kind: 'toggle' \| 'cancel'; targetStatus: TenantStatusAction; label: string }`; table exposes one callback `onStatusAction(item, action)` (replaces `onToggleStatus`) |
| FE pending-dialog state | `pendingStatusAction: { tenant: TenantListItem; targetStatus: TenantStatusAction } | null`; `kind:'toggle'` + `targetStatus:'ACTIVE'` PATCHes directly (unchanged); `targetStatus:'SUSPENDED'` or `kind:'cancel'` opens the dialog |
| es-AR cancel copy | Row trigger button: **"Dar de baja"** (never "Cancelar" — avoids the dialog's own dismiss label); dialog title "Cancelar inquilino definitivamente"; confirm action "Cancelar definitivamente" (pending: "Cancelando…"); dismiss keeps existing "Cancelar" |
| DTO unit coverage | No dedicated `SetTenantStatusDto` spec file exists today — validation is covered end-to-end via `platform-control.controller.spec.ts`; this change follows the same convention (no new isolated DTO spec file) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | WU-1 (backend) ≈ 290–310; WU-2 (FE) ≈ 300–320; combined ≈ 600–630 |
| 400-line budget risk | High if delivered as one PR; each individual WU is safely under 400 |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1, backend: `apps/api` terminality + `apps/viewpro-api` DTO) → PR 2 (WU-2, `viewpro-web` cancel action + dialog variant) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | `apps/api` terminality invariant + `AdminTenantStatusService` gate widen + `apps/viewpro-api` DTO widen + downstream regression confirmations | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/api test` + `pnpm --filter @viewpro/platform-api test` | `POST /api/internal/platform/tenants/:id/status` `{targetStatus:'CANCELLED'}` on an ACTIVE test-DB tenant → 200, then repeat → 400 | Revert `terminal` variant in repository + type; revert `ALLOWED_TARGET_STATUSES`/service mapping; revert DTO `@IsIn` widen — CANCELLED returns to being rejected at the write path, zero data mutation |
| WU-2 | `viewpro-web` destructive Cancel action, distinct confirm-dialog variant, container wiring | PR 2 (base: updated `main` after WU-1 merges) | `pnpm --filter viewpro-web test` | Manual: open tenant console, click "Dar de baja" on an ACTIVE row → distinct destructive dialog, no request until confirm → confirm → `PATCH status=CANCELLED`, list refetches | Revert `TenantStatusAction` widen, `getTenantActions`, dialog `variant` prop, and container wiring — table falls back to a single toggle action, no cancel button rendered |

---

## Dependency Graph

```
T-01 (RED: repo terminal-variant unit tests)
  └── T-02 (GREEN: terminal variant in repository type + prisma repo, before 'unchanged')
        └── T-03 (RED: service tests — CANCELLED accepted target + terminal→400)
              └── T-04 (GREEN: ALLOWED_TARGET_STATUSES += CANCELLED; map terminal→BadRequestException)
                    └── T-05 (RED: apps/api integration regression — cancel scenarios + terminality + ACTIVE⇄SUSPENDED)
                          └── T-06 (GREEN: confirm T-05 green, no new code expected)
                                └── T-07 (verify: existing access-cut e2e regression still covers CANCELLED)
                                      └── T-08 (RED: viewpro-api DTO regression — flip CANCELLED-rejected test, add relay assertions)
                                            └── T-09 (GREEN: widen SetTenantStatusDto @IsIn + type + docstring)
                                                  └── T-10 (RED: terminality-400-relay test, viewpro-api)
                                                        └── T-11 (GREEN: confirm T-10 green, no new code expected)
                                                              └── T-12 (RED: metrics byStatus + platform_tenants projection CANCELLED coverage)
                                                                    └── T-13 (GREEN: confirm T-12 green, no new code expected)
                                                                          └── T-14 (WU-1 verification + commit)
                                                                                └── T-15 (widen TenantStatusAction type)
                                                                                      └── T-16 (RED: tenants-table — getTenantActions + Dar de baja button)
                                                                                            └── T-17 (GREEN: tenants-table.tsx impl)
                                                                                                  └── T-18 (RED: confirm-dialog variant='cancel' tests)
                                                                                                        └── T-19 (GREEN: dialog variant prop + copy map)
                                                                                                              └── T-20 (RED: management-page cancel-flow wiring tests)
                                                                                                                    └── T-21 (GREEN: management-page wiring impl)
                                                                                                                          └── T-22 (WU-2 verification + commit)
                                                                                                                                └── T-23 (final cross-app verification)
```

---

## WU-1 — Backend domain gate + terminality + control-lane DTO

### [x] T-01 — RED: repo terminal-variant unit tests
**Type**: test (RED) · **Spec**: admin-tenant-status — CANCELLED Is Terminal (all 3 scenarios) · **WU**: WU-1, commit 1 · **Depends on**: nothing

- `apps/api/src/admin/__tests__/prisma-admin-tenant-status.repository.spec.ts` — add, following the existing `makeMockTx` pattern:
  - Locked row `status: CANCELLED`, `targetStatus: ACTIVE` → `{ status: 'terminal', tenantId, currentStatus: 'CANCELLED', updatedAt }`; `tenant.update` NOT called; `outboxWriter.emit` NOT called
  - Locked row `status: CANCELLED`, `targetStatus: SUSPENDED` → same terminal result, zero writes
  - Locked row `status: CANCELLED`, `targetStatus: CANCELLED` → terminal (NOT `unchanged: true`) — proves ordering (D2)

**Exit**: new assertions fail (type error or wrong result shape).
**Commit**: `test(api): RED — repo terminal-variant for CANCELLED current status (D1/D2)`

### [x] T-02 — GREEN: terminal variant in repository
**Type**: impl · **Spec**: admin-tenant-status — CANCELLED Is Terminal · **WU**: WU-1, commit 2 · **Depends on**: T-01

- `apps/api/src/admin/admin-tenant-status.repository.ts`: add `| { status: 'terminal'; tenantId: string; currentStatus: TenantStatus; updatedAt: Date }` to `UpdateAdminTenantStatusResult`
- `apps/api/src/admin/prisma-admin-tenant-status.repository.ts`: right after the `FOR UPDATE` fetch and BEFORE the `unchanged` check, add `if (tenant.status === 'CANCELLED') return { status: 'terminal', tenantId: tenant.id, currentStatus: tenant.status, updatedAt: tenant.updatedAt }`
- Confirm T-01 GREEN; prior repo tests (T-08 AUDIT_LOGGED suite) unaffected

**Exit**: `pnpm --filter @viewpro/api test` — T-01 GREEN, no regressions.
**Commit**: `feat(api): terminal result variant — CANCELLED rejected before unchanged (D1/D2)`

### [x] T-03 — RED: service tests — CANCELLED target accepted + terminal → 400
**Type**: test (RED) · **Spec**: admin-tenant-status — Writable-Target Status Policy; CANCELLED Is Terminal · **WU**: WU-1, commit 3 · **Depends on**: T-02

- `apps/api/src/admin/__tests__/admin-tenant-status.service.spec.ts` — add:
  - `targetStatus: CANCELLED` no longer throws at the `ALLOWED_TARGET_STATUSES` check (repo stub called)
  - repo stub resolves `{ status: 'terminal', ... }` → service rejects with `BadRequestException`; repo `updateTenantStatus` was still called once (rejection happens after the DB read, not a pre-check short-circuit)
  - regression: `TRIAL` still throws `BadRequestException` (existing test, unchanged)

**Exit**: new assertions fail.
**Commit**: `test(api): RED — service accepts CANCELLED target; maps terminal → 400`

### [x] T-04 — GREEN: service gate widen + terminal mapping
**Type**: impl · **Spec**: admin-tenant-status — Writable-Target Status Policy; CANCELLED Is Terminal · **WU**: WU-1, commit 4 · **Depends on**: T-03

- `apps/api/src/admin/admin-tenant-status.service.ts`:
  - `ALLOWED_TARGET_STATUSES = new Set([TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CANCELLED])`
  - After the repo call, before the `notFound` branch reads naturally: `if (result.status === 'terminal') throw new BadRequestException('Cancelled tenant cannot change status')`
- Confirm T-03 GREEN; full admin unit suite GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-03 GREEN, no regressions.
**Commit**: `feat(api): CANCELLED as writable target + terminal → BadRequestException`

### [x] T-05 — RED: apps/api integration regression — cancel scenarios + terminality + toggle regression
**Type**: test (RED) · **Spec**: admin-tenant-status — all MODIFIED/ADDED requirements · **WU**: WU-1, commit 5 · **Depends on**: T-04

- `apps/api/src/platform-control/__tests__/platform-control.controller.spec.ts` — add against `POST /api/internal/platform/tenants/:id/status`:
  - `targetStatus: CANCELLED` from a seeded ACTIVE tenant → 200; one `TENANT_STATUS_CHANGED` + one `AUDIT_LOGGED` analytics/outbox row; `previousValue.status` = `ACTIVE`
  - Same for a SUSPENDED-seeded tenant and a TRIAL-seeded tenant (both → 200, CANCELLED)
  - Cancel then re-PATCH `targetStatus: ACTIVE` on the now-CANCELLED tenant → 400; tenant status remains `CANCELLED` in DB (R1 regression, AC4)
  - `CANCELLED → CANCELLED` on that same tenant → 400 (not the `unchanged` 200 shape)
  - Existing `ACTIVE ⇄ SUSPENDED` tests (lines 91–105, 188–206) stay green unmodified (regression b)

**Exit**: new assertions fail before this change lands.
**Commit**: `test(api): RED — integration: cancel ACTIVE/SUSPENDED/TRIAL→200, CANCELLED→* →400 (R1)`

### [x] T-06 — GREEN: confirm integration suite green
**Type**: impl · **Spec**: same as T-05 · **WU**: WU-1, commit 6 · **Depends on**: T-05

- No new production code expected — T-02/T-04 already implement the gate
- Run `pnpm --filter @viewpro/api test`; fix any wiring gap surfaced only at the integration layer

**Exit**: T-05 assertions GREEN; full `apps/api` suite GREEN.
**Commit**: `test(api): GREEN — confirm cancel/terminality integration behavior`

### [x] T-07 — Verify existing access-cut regression already covers CANCELLED
**Type**: verify · **Spec**: admin-tenant-status — Downstream Effects (Members of a newly-CANCELLED tenant are blocked) · **WU**: WU-1, commit 7 · **Depends on**: T-06

- `apps/api/test/tenant-context.e2e-spec.ts:101–119` (`rejects access for suspended and cancelled tenants`) already asserts a CANCELLED tenant's member gets 403 `Tenant is not active` — no code or test change needed (guard is status-agnostic)
- Run `pnpm --filter @viewpro/api test:e2e` (or the project's e2e command) to reconfirm it still passes after T-02/T-04

**Exit**: existing e2e assertion passes unmodified.
**Commit**: `test(api): verify — access-cut guard regression still covers CANCELLED (no change)`

### [x] T-08 — RED: viewpro-api DTO regression — flip rejected-CANCELLED test, add forward assertions
**Type**: test (RED) · **Spec**: platform-control-lane-outbound — Operator Command: Tenant Status (all 3 scenarios) · **WU**: WU-1, commit 8 · **Depends on**: T-07

- `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts`:
  - Replace the existing `'PATCH with targetStatus=CANCELLED → 400 locally, no outbound call made'` test (lines 184–194) with `'PATCH with status=CANCELLED → 200, forwards targetStatus=CANCELLED to InmoView'` — asserts `mockClient.postTenantStatus` called once with `cmd.targetStatus === 'CANCELLED'`
  - Keep the `TRIAL → 400 locally, no outbound call` test unmodified (regression)
  - Keep the existing ACTIVE/SUSPENDED forwarding tests unmodified (regression)

**Exit**: the flipped assertion fails against current `@IsIn(['ACTIVE','SUSPENDED'])`.
**Commit**: `test(platform-api): RED — DTO forwards CANCELLED; TRIAL still rejected locally`

### [x] T-09 — GREEN: widen SetTenantStatusDto
**Type**: impl · **Spec**: platform-control-lane-outbound — Operator Command: Tenant Status · **WU**: WU-1, commit 9 · **Depends on**: T-08

- `apps/viewpro-api/src/platform-control/dto/set-tenant-status.dto.ts`:
  - `@IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED'])`
  - `status!: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'`
  - Update the docstring — CANCELLED is now a valid target; TRIAL remains rejected locally

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-08 GREEN, no regressions.
**Commit**: `feat(platform-api): widen SetTenantStatusDto to accept CANCELLED (D5)`

### [x] T-10 — RED: terminality-400 relay test (viewpro-api)
**Type**: test (RED) · **Spec**: platform-control-lane-outbound — Terminality Rejection Is Relayed Unchanged · **WU**: WU-1, commit 10 · **Depends on**: T-09

- `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts` — add:
  - `mockClient.postTenantStatus.mockRejectedValue(...400-shaped error...)` → `PATCH /operators/tenants/:id/status` with any `status` → operator receives 400; `mockClient.postTenantStatus` was called once (no retry); no special-cased branching exercised

**Exit**: new assertion fails or is trivially satisfied without proof the generic path is exercised — write it to genuinely fail first (e.g. assert exact 400, not `>= 400`).
**Commit**: `test(platform-api): RED — terminality 400 relayed via existing generic failure path`

### [x] T-11 — GREEN: confirm relay green
**Type**: impl · **Spec**: same as T-10 · **WU**: WU-1, commit 11 · **Depends on**: T-10

- No new code expected (D3 — verified generic chain). Run the suite; fix only if the generic forwarding path has a gap.

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-10 GREEN.
**Commit**: `test(platform-api): GREEN — confirm terminality 400 passthrough (D3)`

### [x] T-12 — RED: metrics + projection CANCELLED coverage
**Type**: test (RED) · **Spec**: admin-tenant-status — Downstream Effects (projection + metrics scenarios) · **WU**: WU-1, commit 12 · **Depends on**: T-11

- `apps/viewpro-api/src/platform-data/__tests__/metrics.controller.spec.ts` — add, mirroring the existing SUSPENDED-bucket test (lines 130–153): ingest a `TENANT_STATUS_CHANGED` mirror event with `newStatus: 'CANCELLED'` → `byStatus.CANCELLED >= 1`
- Ingest/tenant-registry test (e.g. `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts`) — add: `TENANT_STATUS_CHANGED` with `newStatus: 'CANCELLED'` for an existing tenant → `platform_tenants.latestStatus === 'CANCELLED'`

**Exit**: new assertions fail before running (bucket/row absent).
**Commit**: `test(platform-api): RED — byStatus CANCELLED bucket + platform_tenants latestStatus=CANCELLED`

### [x] T-13 — GREEN: confirm metrics/projection green
**Type**: impl · **Spec**: same as T-12 · **WU**: WU-1, commit 13 · **Depends on**: T-12

- No new code expected (D4 — both paths are status-string-generic). Run the suite; fix only if a gap surfaces.

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-12 GREEN.
**Commit**: `test(platform-api): GREEN — confirm CANCELLED flows through metrics/projection unchanged (D4)`

### [x] T-14 — WU-1 verification + commit
**Type**: verify · **Spec**: proposal AC1–4, 6, 7 · **WU**: WU-1, commit 14 · **Depends on**: T-13

- `pnpm --filter @viewpro/api test` — all GREEN
- `pnpm --filter @viewpro/api typecheck` — passes
- `pnpm --filter @viewpro/platform-api test` — all GREEN
- `pnpm --filter @viewpro/platform-api typecheck` — passes
- `git diff HEAD -- apps/app-new/` — empty (D8, no legacy console touch)

**Exit**: all 5 checks pass.
**Commit**: `chore(platform-tenant-cancel): WU-1 backend verification — terminality + DTO widen`

---

## WU-2 — viewpro-web destructive Cancel action

### [x] T-15 — Widen `TenantStatusAction` type
**Type**: impl · **Spec**: operator-tenant-management-ui — Destructive Cancel Action (`TenantStatusAction` widen) · **WU**: WU-2, commit 1 · **Depends on**: T-14

- `apps/viewpro-web/src/features/tenants/api/types.ts`:
  - `export type TenantStatusAction = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';`
  - Update the comment above it (no longer asymmetric with `TenantStatus` for CANCELLED)

**Exit**: `pnpm --filter viewpro-web typecheck` passes with the widened union.
**Commit**: `feat(web): widen TenantStatusAction to include CANCELLED`

### [x] T-16 — RED: tenants-table — getTenantActions + "Dar de baja" button
**Type**: test (RED) · **Spec**: operator-tenant-management-ui — Destructive Cancel Action; No Status Actions on a CANCELLED Row · **WU**: WU-2, commit 2 · **Depends on**: T-15

- `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-table.spec.tsx`:
  - Rename `getTenantAction` references to `getTenantActions`; for ACTIVE/SUSPENDED/TRIAL rows assert the array has 2 entries: the existing toggle (`kind:'toggle'`) and `{ kind:'cancel', targetStatus:'CANCELLED', label:'Dar de baja' }`
  - Render test: ACTIVE row shows both "Suspender" and "Dar de baja" buttons; clicking "Dar de baja" emits `onStatusAction(item, { kind:'cancel', targetStatus:'CANCELLED', label:'Dar de baja' })`
  - CANCELLED row: update the existing `queryByRole` regression assertion to also exclude `/dar de baja/i` (still zero status-action buttons; "Editar límites" still renders)
  - `isMutating={true}` disables every button on every row (existing loop-based assertion, now covering the extra cancel button too — no new test needed, keep as regression)

**Exit**: new assertions fail (function/prop don't exist yet).
**Commit**: `test(web): RED — getTenantActions returns [toggle, cancel]; Dar de baja button (D6)`

### [x] T-17 — GREEN: tenants-table.tsx impl
**Type**: impl · **Spec**: same as T-16 · **WU**: WU-2, commit 3 · **Depends on**: T-16

- `apps/viewpro-web/src/features/tenants/components/tenants-table.tsx`:
  - Replace `getTenantAction` with `export function getTenantActions(item: TenantListItem): TenantAction[]` — `TRIAL/ACTIVE/SUSPENDED` → `[toggle, cancel]`; `CANCELLED` → `[]`
  - Export `TenantAction = { kind: 'toggle' | 'cancel'; targetStatus: TenantStatusAction; label: string }`
  - Replace the single action button with `.map` over `getTenantActions(item)`; cancel action always renders `variant='destructive'`, label "Dar de baja"
  - Replace the `onToggleStatus` prop with `onStatusAction: (item: TenantListItem, action: TenantAction) => void`
- Confirm T-16 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-16 GREEN, no regressions.
**Commit**: `feat(web): getTenantActions + destructive Dar de baja button per row (D6)`

### [x] T-18 — RED: confirm-dialog variant='cancel' tests
**Type**: test (RED) · **Spec**: operator-tenant-management-ui — Destructive Cancel Action (distinct confirmation) · **WU**: WU-2, commit 4 · **Depends on**: T-17

- `apps/viewpro-web/src/features/tenants/components/__tests__/tenant-status-confirm-dialog.spec.tsx`:
  - `variant='cancel'` + tenant set → title/description contain permanent/"no se puede deshacer" framing distinct from the suspend copy; confirm button labeled "Cancelar definitivamente" (pending: "Cancelando…")
  - `variant='suspend'` (default) preserves all 5 existing tests unmodified (regression)
  - Escape-while-pending gating applies identically regardless of `variant` (one added assertion with `variant='cancel'`)

**Exit**: new assertions fail (`variant` prop not implemented).
**Commit**: `test(web): RED — TenantStatusConfirmDialog variant=cancel destructive copy (D7)`

### [x] T-19 — GREEN: dialog variant prop + copy map
**Type**: impl · **Spec**: same as T-18 · **WU**: WU-2, commit 5 · **Depends on**: T-18

- `apps/viewpro-web/src/features/tenants/components/tenant-status-confirm-dialog.tsx`:
  - Add `variant: 'suspend' | 'cancel'` prop; internal copy map keyed by variant (title, description, confirm label, pending label)
  - `cancel`: title "Cancelar inquilino definitivamente", description with explicit "esta acción no se puede deshacer" framing, confirm "Cancelar definitivamente" / pending "Cancelando…"
  - Keep the single pending-gated `onOpenChange`/Escape logic shared across both variants (D7 — one dialog, no new component)
- Confirm T-18 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-18 GREEN, no regressions.
**Commit**: `feat(web): TenantStatusConfirmDialog variant=cancel destructive copy (D7)`

### [x] T-20 — RED: management-page cancel-flow wiring tests
**Type**: test (RED) · **Spec**: operator-tenant-management-ui — Destructive Cancel Action (all 4 scenarios); Error Handling (both scenarios) · **WU**: WU-2, commit 6 · **Depends on**: T-19

- `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-management-page.spec.tsx`:
  - Click "Dar de baja" on an ACTIVE row → dialog opens with `variant='cancel'`; no `PATCH` fired yet
  - Confirm → `PATCH /operators/tenants/:id/status` called with `{ status: 'CANCELLED' }`; on success, list query invalidated/refetched; row reflects `CANCELLED`
  - Dismiss the cancel dialog → no `PATCH`, dialog closes, row unchanged
  - Regression: clicking "Suspender" still opens `variant='suspend'`; clicking "Activar"/"Reactivar" still PATCHes directly with no dialog
  - Cancel `PATCH` → 404 → existing `NOT_FOUND_MESSAGE` toast (reuse `reportMutationError`, no new path)
  - Cancel `PATCH` → 500 → generic error toast, page stays interactive, list retains pre-failure data

**Exit**: new assertions fail (wiring not yet implemented).
**Commit**: `test(web): RED — cancel confirm/dismiss wiring + 404/500 error reuse`

### [x] T-21 — GREEN: management-page wiring impl
**Type**: impl · **Spec**: same as T-20 · **WU**: WU-2, commit 7 · **Depends on**: T-20

- `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx`:
  - Replace `pendingStatusTenant: TenantListItem | null` with `pendingStatusAction: { tenant: TenantListItem; targetStatus: TenantStatusAction } | null`
  - `handleStatusAction(item, action)`: `kind==='toggle' && targetStatus==='ACTIVE'` → `statusMutation.mutate` directly (unchanged); otherwise (`targetStatus==='SUSPENDED'` or `kind==='cancel'`) → `setPendingStatusAction({ tenant: item, targetStatus: action.targetStatus })`
  - `handleConfirmStatusAction`: mutates with `pendingStatusAction.targetStatus`
  - Widen `statusMutation`'s `mutationFn` input `status` type to `TenantStatusAction`
  - Pass `variant={pendingStatusAction?.targetStatus === 'CANCELLED' ? 'cancel' : 'suspend'}` and the new props to `TenantStatusConfirmDialog`; pass `onStatusAction={handleStatusAction}` to `TenantsTable`
- Confirm T-20 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-20 GREEN, no regressions.
**Commit**: `feat(web): wire destructive cancel action through TenantsManagementPage (D7)`

### [x] T-22 — WU-2 verification + commit
**Type**: verify · **Spec**: proposal AC5 · **WU**: WU-2, commit 8 · **Depends on**: T-21

- `pnpm --filter viewpro-web test` — all GREEN
- `pnpm --filter viewpro-web typecheck` — passes
- `pnpm --filter viewpro-web build` — succeeds
- `git diff HEAD -- apps/app-new/` — empty

**Exit**: all 4 checks pass.
**Commit**: `chore(platform-tenant-cancel): WU-2 viewpro-web verification — destructive cancel action`

---

## Final Verification

### [x] T-23 — Cross-app final verification
**Type**: verify · **Spec**: All invariants; proposal acceptance criteria 1–7 · **Depends on**: T-22

1. `pnpm --filter @viewpro/api test` — all GREEN
2. `pnpm --filter @viewpro/api typecheck` — passes
3. `pnpm --filter @viewpro/platform-api test` — all GREEN
4. `pnpm --filter @viewpro/platform-api typecheck` — passes
5. `pnpm --filter viewpro-web test` — all GREEN
6. `pnpm --filter viewpro-web typecheck` — passes
7. `pnpm --filter viewpro-web build` — succeeds
8. Regression proof: `POST /api/internal/platform/tenants/:id/status` on a CANCELLED tenant with `targetStatus: ACTIVE` → 400 (T-05/T-06)
9. `git diff HEAD -- apps/app-new/` — empty (D8)
10. `git diff HEAD -- packages/platform-contract/` — empty (D4, no contract change)
11. `git diff HEAD -- apps/viewpro-api/prisma/` — empty (no migration)

**Exit**: all 11 checks pass; no regressions.
**Commit**: `chore(platform-tenant-cancel): final verification — CANCELLED lifecycle end to end`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-01 RED: repo terminal-variant tests | test | WU-1 | admin-tenant-status — CANCELLED Is Terminal | — |
| T-02 GREEN: terminal variant in repo | impl | WU-1 | D1/D2 | T-01 |
| T-03 RED: service accepts CANCELLED + terminal→400 | test | WU-1 | admin-tenant-status — Writable-Target Policy; Terminal | T-02 |
| T-04 GREEN: service gate + terminal mapping | impl | WU-1 | same | T-03 |
| T-05 RED: apps/api integration regression | test | WU-1 | admin-tenant-status — all MODIFIED/ADDED | T-04 |
| T-06 GREEN: confirm integration green | impl | WU-1 | same | T-05 |
| T-07 verify: access-cut regression | verify | WU-1 | Downstream Effects — membership guard | T-06 |
| T-08 RED: DTO forwards CANCELLED | test | WU-1 | platform-control-lane-outbound — Operator Command | T-07 |
| T-09 GREEN: widen SetTenantStatusDto | impl | WU-1 | D5 | T-08 |
| T-10 RED: terminality 400 relay | test | WU-1 | platform-control-lane-outbound — Terminality Relayed | T-09 |
| T-11 GREEN: confirm relay green | impl | WU-1 | D3 | T-10 |
| T-12 RED: metrics/projection CANCELLED | test | WU-1 | Downstream Effects — projection/metrics | T-11 |
| T-13 GREEN: confirm metrics/projection green | impl | WU-1 | D4 | T-12 |
| T-14 WU-1 verification | verify | WU-1 | AC1–4, 6, 7 | T-13 |
| T-15 widen TenantStatusAction | impl | WU-2 | operator-tenant-management-ui — Destructive Cancel Action | T-14 |
| T-16 RED: getTenantActions + button | test | WU-2 | same; No Status Actions on CANCELLED | T-15 |
| T-17 GREEN: tenants-table.tsx | impl | WU-2 | D6 | T-16 |
| T-18 RED: dialog variant='cancel' | test | WU-2 | Destructive Cancel Action — distinct confirmation | T-17 |
| T-19 GREEN: dialog variant impl | impl | WU-2 | D7 | T-18 |
| T-20 RED: page wiring + error reuse | test | WU-2 | Destructive Cancel Action (4 scenarios); Error Handling | T-19 |
| T-21 GREEN: page wiring impl | impl | WU-2 | D7 | T-20 |
| T-22 WU-2 verification | verify | WU-2 | AC5 | T-21 |
| T-23 cross-app final verification | verify | — | AC1–7 | T-22 |

---

## Success Checklist (maps to spec acceptance criteria)

- [x] Operator cancels ACTIVE/SUSPENDED/TRIAL tenant → 200, `latestStatus = CANCELLED` (T-05, T-06, T-12, T-13)
- [x] Access cut for CANCELLED tenant members — existing guard, verified not regressed (T-07)
- [x] Cancel audited: `AUDIT_LOGGED` with `action: TENANT_STATUS_CHANGED`, real `previousValue` (T-05, T-06)
- [x] Terminality: any `CANCELLED → *` transition (incl. `CANCELLED → CANCELLED`) → 400 server-side, with regression test (T-01–T-06)
- [x] FE distinct destructive Cancel confirmation for non-CANCELLED tenants; CANCELLED rows show zero status actions (T-15–T-22)
- [x] `apps/app-new` legacy console unchanged (T-14, T-22, T-23)
- [x] No data archived or deleted — status transition + access-cut only (verified by scope of file changes, no migration/deletion code introduced)

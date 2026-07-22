# Design: Platform Phase 7 Slice 2 — Sub-slice B — OPERATOR TENANT-MANAGEMENT UI (viewpro-web)

Add a `features/tenants/` module to `viewpro-app/apps/viewpro-web` that mirrors Slice 1's `features/metrics/` architecture verbatim and consumes Sub-slice A's live endpoints: `GET /operators/tenants` (paginated list) plus `PATCH /operators/tenants/:id/status` and `PATCH /operators/tenants/:id/limits`. The feature talks ONLY to viewpro-api via `apiRequest` (Design B, no BFF). It copy-adapts app-new's proven `AdminTenantManagementPage` / `TenantLimitsDialog` / `LimitInput`, stripping the `globalRole === 'VIEWPRO_ADMIN'` gate (viewpro-web `Session` has no role; the viewpro-api `AuthGuard` grants any authenticated operator full access). All paths below are under `viewpro-app/`.

## Technical Approach

Copy `features/metrics/`'s data-layer shape (`api/{types,service,queries}.ts` + `components/` + `__tests__`) and swap the contract for the tenants endpoints. The GET list is a TanStack `useQuery` keyed by `offset`/`limit`; the two PATCHes are `useMutation`s that **invalidate-and-refetch** the list on success (not optimistic — mirrors Slice 1's read-model discipline). The list renders in a plain shadcn `Table` with an offset/limit pager (no `data-table.tsx`: the API exposes no sort/filter params, only `offset`/`limit`/`total`). The limits editor is a raw-`useState` form inside a modal `Dialog` (app-new's `LimitInput` pattern, not `@tanstack/react-form`). Status changes flow through a per-row action button; **SUSPEND is gated behind an `AlertDialog` confirm**, activate fires directly. Double-submit is prevented by disabling the acting control while its mutation `isPending` (the idempotency key is minted per-call server-side, so the only client risk is a double-click before the first request resolves).

The load-bearing risk is that both PATCH endpoints are typed `Promise<unknown>` on viewpro-api (`platform-control.controller.ts`) — the response is an opaque passthrough of InmoView's control-lane body (and can be an idempotency-replayed `JsonValue`). The FE is therefore the source of truth for shape: `api/types.ts` declares FE-owned `AdminTenant{Status,Limits}UpdateResponse` types traced from InmoView's response mappers, and `api/schemas.ts` validates the `unknown` body with **zod** (already a dependency — `zod ^4.3.6`) before any field is read. The dead `@viewpro/platform-contract` `SetTenantStatusResult`/`SetTenantLimitsResult` types are NOT imported.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Module shape | Mirror `features/metrics/` exactly: `api/{types,service,queries}.ts` + `components/` + `__tests__` | ad-hoc placement; a single mega-file | A reviewed, proven layout already exists in this app; matching it keeps the review surface tiny and the mental model shared |
| D2 | Transport | Design B — `apiRequest` from `@/lib/api-client` direct to viewpro-api; no Next.js BFF route | a `/api/...` route handler (app-new style) | `apiRequest` already sets `credentials:'include'`, normalizes errors to `ApiError`, and enforces the viewpro-api-only isolation. A BFF route would re-introduce a hop the metrics slice deliberately dropped |
| D3 | Response types ownership | FE declares `AdminTenantStatusUpdateResponse` / `AdminTenantLimitsUpdateResponse` / `TenantListItem` / `TenantListResponse` in `api/types.ts`, traced from viewpro-api source | import `@viewpro/platform-contract` `SetTenant*Result` | The contract types are dead/misleading (differ from the wire). viewpro-api types the PATCH responses as `unknown` — the FE MUST own the shape. Traced shapes (below) are exact |
| D4 | Untyped PATCH parsing | Fetch as `apiRequest<unknown>`, then `zod.safeParse` against a narrow schema in `api/schemas.ts`; on failure throw a normalized `ApiError`-shaped error so the UI surfaces it | trust-and-cast `as`; a hand-rolled type guard | zod is already a dep (no new package). A blind cast would let a malformed/absent field (e.g. an idempotency-replay `JsonValue`) crash a `.toLocaleString()` deep in render. Parse-at-the-boundary keeps components total-typed |
| D5 | List rendering | Plain shadcn `Table` + a dedicated offset/limit pager component | `data-table.tsx` (`@tanstack/react-table`) | The API has no sort/filter/column params — only `offset`/`limit`/`total`. `data-table` would add a client-sort illusion over a server-paged set. Plain `Table` matches the contract 1:1 |
| D6 | Limits form state | Raw `useState<Record<keyof Limits,string>>` (copy app-new's `LimitInput`) | `@tanstack/react-form` (present in deps) | Three optional numeric fields do not justify a form library. app-new's string-state + `parseLimitInputValue` (empty→`null`) is proven and directly portable |
| D7 | Limits UX surface | Modal `Dialog` seeded from the list row on open (no fetch-by-id — there is no single-tenant GET) | inline row-expand editor | Locked. A modal matches app-new, isolates the form lifecycle, and re-seeds via `useEffect(...,[tenant])`. Detail data comes entirely from the list row (R3) |
| D8 | Suspend confirmation | `AlertDialog` confirm before a SUSPEND PATCH; ACTIVE/reactivate fires without confirm | confirm every action; no confirm | Locked (confirm-before-suspend). Suspend is the only destructive transition; gating just it keeps activate/reactivate one-click while preventing accidental lockout (R5) |
| D9 | Post-mutation refresh | On success `queryClient.invalidateQueries({ queryKey: tenantsKeys.list(...) })` (or `refetch()`), close the dialog, toast | optimistic cache write | Locked. The list is a server-derived projection; invalidate-and-refetch guarantees the row reflects the confirmed server state (incl. `unchanged:true`) without reconciliation logic |
| D10 | Access gate | None — render for any authenticated operator; `useSession()` only drives the app-shell, not a role check | port app-new's `isAdmin`/`AdminRestrictedState` | Locked. viewpro-web `Session` has no `globalRole`; the viewpro-api `AuthGuard` (cookie) is the sole gate. A 401 on the list already redirects to sign-in via `session-context` (D6 of Slice 1) |
| D11 | Double-submit guard | Disable the acting button (row action / dialog confirm / dialog save) while its mutation `isPending` | client-side idempotency key; debounce | Locked. The server mints the idempotency key per call, so the only window is a double-click pre-resolution; `disabled={mutation.isPending}` closes it with zero extra state |
| D12 | Container/presentational split | A `tenants-management-page.tsx` **container** owns queries/mutations/dialog state; `tenants-table`, `tenant-limits-dialog`, `tenant-status-confirm-dialog`, `tenants-pager`, `tenants-empty-state` are **presentational** (props in, callbacks out) | put orchestration in the route `page.tsx` (metrics style) | app-new (the template) uses a container component; keeping it lets the container be unit-tested without the Next route and matches the atomic/container-presentational convention |
| D13 | List query keys | `tenantsKeys.list(offset, limit)` = `['tenants','list',offset,limit]`; `offset`/`limit` held in the container via `useState` (default `offset=0`, `limit=50`) | `nuqs`/URL-synced paging; a single unkeyed query | Keying by `offset`/`limit` gives correct cache separation and `keepPreviousData`-friendly paging. URL-sync is out of scope; a single key would thrash on page change |
| D14 | Status typing | `TenantStatus = 'TRIAL'\|'ACTIVE'\|'SUSPENDED'\|'CANCELLED'` for display; `TenantStatusAction = 'ACTIVE'\|'SUSPENDED'` for the PATCH body; `getTenantAction(row)` maps status→next action (copy app-new) | a single closed enum for both | The list `status` (from `latestStatus`) may be any of the four; the PATCH body accepts only `ACTIVE`/`SUSPENDED` (server `SetTenantStatusDto` `@IsIn`). Two types encode that asymmetry precisely |
| D15 | Error / 404 surfacing | Container renders an inline error card via `getApiErrorMessage(error)`; mutation `onError` fires a `sonner` toast; a 404 (`isApiError && status===404`) shows a "tenant no encontrado" message | swallow; a generic alert | `apiRequest` already normalizes downstream statuses (the control lane rethrows InmoView's 404/400 verbatim). Reusing `getApiErrorMessage`/`isApiError` matches Slice 1 and keeps copy consistent |
| D16 | Route + nav | New route `app/dashboard/tenants/page.tsx` (thin, renders the container inside `PageContainer`); add a `Tenants` item to `navGroups` in `config/nav-config.ts` (`url:'/dashboard/tenants'`, `icon:'listDetails'`) | a top-level `/tenants` route; a new nav group | Placing it under `/dashboard` reuses the operator app-shell/layout and sidebar. A second item in the existing `Operaciones` group sits naturally beside `Dashboard` (metrics) |

## Data Flow

    Operator opens /dashboard/tenants
      app/dashboard/tenants/page.tsx  (thin route, 'use client')
        <PageContainer><TenantsManagementPage/></PageContainer>

    TenantsManagementPage (container — D12)
      const [offset,setOffset] = useState(0); const limit = 50
      useQuery(tenantsListOptions(offset, limit))           ← GET /operators/tenants?offset&limit
        queryFn → getTenantList(offset,limit) → apiRequest<TenantListResponse>(...)
        → { total, items:[{ id,name,slug,status,limits }] }   (name ASC, server-capped limit≤200)
      states: isLoading→skeleton | isError→<error card getApiErrorMessage> | data→<TenantsTable/> + <TenantsPager/>
        empty: data.total===0 → <TenantsEmptyState/>

    Row action (status) — D8/D11
      TenantsTable emits onToggleStatus(row) → getTenantAction(row):
        status ACTIVE  → target SUSPENDED → open <TenantStatusConfirmDialog/> (AlertDialog)
        status TRIAL/SUSPENDED → target ACTIVE → statusMutation.mutate(...) directly (no confirm)
      confirm → statusMutation.mutate({ tenantId, status:'SUSPENDED' })
        mutationFn → updateTenantStatus(id,{status}) → apiRequest<unknown> PATCH .../status
          → zod parseStatusResponse(raw)  (D4) → AdminTenantStatusUpdateResponse
        onSuccess(res): res.unchanged ? toast.info('ya tenía ese estado') : toast.success
          → invalidate tenantsKeys.list → close dialog
        onError: toast.error(getApiErrorMessage) ; 404 → "tenant no encontrado"
      button disabled while statusMutation.isPending (D11)

    Row action (limits) — D6/D7/D11
      TenantsTable emits onEditLimits(row) → open <TenantLimitsDialog tenant=row/>
        useState string-values seeded from row.limits via useEffect([tenant]) (empty ⇒ "sin límite")
        submit → limitsMutation.mutate({ tenantId, limits:{ maxUsers|null, ...×3 } })
          mutationFn → updateTenantLimits(id,limits) → apiRequest<unknown> PATCH .../limits
            → zod parseLimitsResponse(raw) (D4) → AdminTenantLimitsUpdateResponse
          onSuccess(res): res.unchanged ? toast.info : toast.success
            → invalidate tenantsKeys.list → close dialog
        save button disabled while limitsMutation.isPending (D11)

    Pager — D5/D13
      <TenantsPager offset limit total onPrev onNext/>
        onNext → setOffset(o=>o+limit) (guard o+limit<total) ; onPrev → setOffset(o=>max(0,o-limit))
        query re-runs on the new offset key

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-web/src/features/tenants/api/types.ts` | Create | FE-owned types: `TenantStatus`, `TenantStatusAction`, `TenantLimits`, `TenantListItem`, `TenantListResponse`, `UpdateTenantStatusPayload`, `UpdateTenantLimitsPayload`, `AdminTenantStatusUpdateResponse`, `AdminTenantLimitsUpdateResponse`. Comment: do NOT import platform-contract `SetTenant*Result` (D3) |
| `apps/viewpro-web/src/features/tenants/api/schemas.ts` | Create | zod schemas + `parseStatusResponse(raw:unknown)` / `parseLimitsResponse(raw:unknown)` that `safeParse` and throw a normalized error on failure (D4) |
| `apps/viewpro-web/src/features/tenants/api/service.ts` | Create | `getTenantList(offset,limit)` (GET), `updateTenantStatus(id,payload)` + `updateTenantLimits(id,payload)` (PATCH via `apiRequest<unknown>` then parse). All use `apiRequest`; PATCH sets `method:'PATCH'`, `body` (D2) |
| `apps/viewpro-web/src/features/tenants/api/queries.ts` | Create | `tenantsKeys` (`all`,`list(offset,limit)`), `tenantsListOptions(offset,limit)` `queryOptions` (D13). Mutations live in the container via `useMutation` (parallels Slice 1 keeping `queryOptions` here) |
| `apps/viewpro-web/src/features/tenants/api/__tests__/tenants-api.spec.ts` | Create | Unit tests: service calls correct path/method/body; zod parse accepts valid + rejects malformed; keys are stable (mirrors `metrics.spec.ts`) |
| `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx` | Create | Container (D12): list query, status + limits mutations, dialog/pending state, loading/error/empty branching. Copy-adapt `AdminTenantManagementPage` minus the role gate (D10) |
| `apps/viewpro-web/src/features/tenants/components/tenants-table.tsx` | Create | Presentational `Table`: columns name/slug, status badge, limits summary, actions (edit-limits, status toggle). Emits `onEditLimits`/`onToggleStatus`; `isMutating` disables actions |
| `apps/viewpro-web/src/features/tenants/components/tenant-limits-dialog.tsx` | Create | `Dialog` + raw-`useState` form + `LimitInput` (copy app-new). Seeds from `tenant.limits`; "Sin límite" clears to empty→`null` (D6) |
| `apps/viewpro-web/src/features/tenants/components/tenant-status-confirm-dialog.tsx` | Create | `AlertDialog` confirm shown only for SUSPEND (D8); confirm button disabled while pending |
| `apps/viewpro-web/src/features/tenants/components/tenants-pager.tsx` | Create | Offset/limit pager: prev/next + "mostrando X–Y de total" (D5/D13) |
| `apps/viewpro-web/src/features/tenants/components/tenants-empty-state.tsx` | Create | Empty-list card (`total===0`), copy-mirroring `metrics-empty-state.tsx` |
| `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-table.spec.tsx` | Create | Renders rows, status badge, action buttons; pending disables actions |
| `apps/viewpro-web/src/features/tenants/components/__tests__/tenant-limits-dialog.spec.tsx` | Create | Seeds from row; clear→null; submit emits parsed payload; pending disables save |
| `apps/viewpro-web/src/features/tenants/components/__tests__/tenants-management-page.spec.tsx` | Create | Loading/empty/error/success; suspend confirm gate; `unchanged` toast; invalidate-on-success; 404 message |
| `apps/viewpro-web/src/app/dashboard/tenants/page.tsx` | Create | Thin `'use client'` route: `<PageContainer pageTitle="Inquilinos"><TenantsManagementPage/></PageContainer>` (D16) |
| `apps/viewpro-web/src/app/dashboard/tenants/__tests__/page.spec.tsx` | Create | Route renders the container (mirrors metrics `page.spec.tsx`) |
| `apps/viewpro-web/src/config/nav-config.ts` | Modify | Add `{ title:'Inquilinos', url:'/dashboard/tenants', icon:'listDetails', items:[] }` to the `Operaciones` group (D16) |

## Interfaces / Contracts

FE-owned types in `api/types.ts` — traced against viewpro-api source (`tenant-registry.service.ts`, `admin/responses/admin-tenant-{status,limits}.response.ts`). The two PATCH responses are typed `unknown` on the server (`platform-control.controller.ts`); the FE is the shape authority (D3/D4).

    // ── api/types.ts ────────────────────────────────────────────────────────────
    export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
    export type TenantStatusAction = 'ACTIVE' | 'SUSPENDED';   // PATCH body accepts only these (SetTenantStatusDto @IsIn)

    export type TenantLimits = {
      maxUsers: number | null;
      maxActivePropertyEngagements: number | null;
      maxDocumentsStorageMb: number | null;
    };

    // GET /operators/tenants?offset&limit → TenantRegistryList (viewpro-api tenant-registry.service.ts)
    export type TenantListItem = {
      id: string; name: string; slug: string;
      status: TenantStatus;          // = platform_tenants.latestStatus (server types it `string`; FE narrows)
      limits: TenantLimits;
    };
    export type TenantListResponse = { total: number; items: TenantListItem[] };

    // PATCH bodies
    export type UpdateTenantStatusPayload = { status: TenantStatusAction };
    export type UpdateTenantLimitsPayload = TenantLimits;

    // PATCH responses — passthrough of InmoView control-lane bodies (server type: unknown).
    // Shapes traced from apps/api/src/admin/responses/*.response.ts. DO NOT import
    // @viewpro/platform-contract SetTenantStatusResult / SetTenantLimitsResult (dead, wrong shape).
    export type AdminTenantStatusUpdateResponse = {
      tenantId: string;
      previousStatus: TenantStatus;
      status: TenantStatus;
      unchanged: boolean;
      updatedAt: string;             // ISO string
    };
    export type AdminTenantLimitsUpdateResponse = {
      tenantId: string;
      previousLimits: TenantLimits;
      limits: TenantLimits;
      unchanged: boolean;
      updatedAt: string;             // ISO string
    };

    // ── api/schemas.ts (zod ^4.3.6 — already a dep) ──────────────────────────────
    const limitsSchema = z.object({
      maxUsers: z.number().int().nullable(),
      maxActivePropertyEngagements: z.number().int().nullable(),
      maxDocumentsStorageMb: z.number().int().nullable()
    });
    const statusResponseSchema = z.object({
      tenantId: z.string(), previousStatus: z.string(), status: z.string(),
      unchanged: z.boolean(), updatedAt: z.string()
    });
    const limitsResponseSchema = z.object({
      tenantId: z.string(), previousLimits: limitsSchema, limits: limitsSchema,
      unchanged: z.boolean(), updatedAt: z.string()
    });
    export function parseStatusResponse(raw: unknown): AdminTenantStatusUpdateResponse {
      const r = statusResponseSchema.safeParse(raw);
      if (!r.success) throw { status: 502, message: 'Respuesta inesperada del servidor.' } satisfies ApiError;
      return r.data as AdminTenantStatusUpdateResponse;   // status/previousStatus narrowed to TenantStatus at the type edge
    }
    // parseLimitsResponse: symmetric, over limitsResponseSchema.

    // ── api/service.ts ───────────────────────────────────────────────────────────
    getTenantList(offset,limit): apiRequest<TenantListResponse>(`/operators/tenants?offset=${offset}&limit=${limit}`)
    updateTenantStatus(id, payload): parseStatusResponse(
      await apiRequest<unknown>(`/operators/tenants/${encodeURIComponent(id)}/status`, { method:'PATCH', body: payload }))
    updateTenantLimits(id, payload): parseLimitsResponse(
      await apiRequest<unknown>(`/operators/tenants/${encodeURIComponent(id)}/limits`, { method:'PATCH', body: payload }))

Note: `status`/`previousStatus` are validated as `z.string()` (defensive — the server column is a raw string) and surfaced through the `TenantStatus` union type; an unexpected value renders as its raw label via `getStatusLabel(x) ?? x` (copy app-new) rather than throwing.

## Edge Cases

| Case | Handling |
|------|----------|
| `unchanged: true` (status or limits already at target) | Mutation `onSuccess` inspects `res.unchanged` → `toast.info('… ya tenía ese estado/esos límites')` instead of a success toast; still invalidates + closes (D9) |
| Clearing a limit → `null` | `LimitInput` "Sin límite" button sets the string to `''`; `parseLimitInputValue('')===null`; the PATCH body carries `null` (D6). Empty input is allowed only for `''` or `^\d+$` (app-new `isLimitInputValueAllowed`) |
| Double-submit | Acting control `disabled={mutation.isPending}` (row action button, AlertDialog confirm, Dialog save) (D11) |
| 404 (unknown tenant — control lane rethrows InmoView's status) | `onError`: `isApiError(e) && e.status===404` → "El inquilino no existe o fue eliminado."; other statuses → `getApiErrorMessage(e)` (D15) |
| Malformed / replayed PATCH body (`unknown` / `JsonValue`) | `zod.safeParse` fails → normalized `{status:502,...}` error → surfaced via the mutation error toast; no field is read unvalidated (D4) |
| Empty list (`total===0`) | Container renders `<TenantsEmptyState/>`; the table/pager are not shown (D5) |
| List load error (non-401) | Inline error card via `getApiErrorMessage(query.error)` (D15). A 401 is intercepted upstream by `session-context` → redirect to sign-in (D10) |
| Pager bounds | `onNext` disabled/guarded when `offset+limit >= total`; `onPrev` disabled when `offset===0`; `limit` fixed at 50 (server caps at 200) |

## Isolation Proof

1. Every request originates from `apiRequest` (`@/lib/api-client`), whose base URL is `NEXT_PUBLIC_API_URL` → viewpro-api only. No InmoView URL, no BFF `/api/...` route handler is added (D2 — acceptance #9).
2. `api/types.ts` imports nothing from `@viewpro/platform-contract`; a comment and an api-test assertion (grep-style/import check) keep the dead `SetTenant*Result` types out (D3 — acceptance #10).
3. The feature is purely additive: no change to `api-client.ts`, `session-context.tsx`, or the metrics module. Rollback = delete `features/tenants/`, `app/dashboard/tenants/`, and revert the one `nav-config.ts` line.

## Testing Strategy

vitest + @testing-library/react + jsdom (the app's existing setup). Tests mirror Slice 1's `metrics.spec.ts` / `page.spec.tsx` structure. Mapping to acceptance criteria (proposal §4):

| Layer | Test | Covers |
|-------|------|--------|
| Unit (api) | `getTenantList` calls `GET /operators/tenants?offset&limit`; returns `{total,items}` | AC1, AC2 |
| Unit (api) | `updateTenantStatus` PATCHes `.../status` with `{status}`; `updateTenantLimits` PATCHes `.../limits` with 3 fields | AC3, AC5 |
| Unit (schemas) | `parseStatusResponse`/`parseLimitsResponse` accept the traced shape; reject `{}`/wrong-typed/`null` with the normalized error | AC7 (defensive), R1 |
| Unit (queries) | `tenantsKeys.list(offset,limit)` stable; `tenantsListOptions` carries the right key + queryFn | AC1 |
| Component (table) | Renders name/slug/status/limits/action rows; `isMutating` disables action buttons | AC1, AC6 |
| Component (limits dialog) | Seeds from row; "Sin límite" → `null`; submit emits parsed payload; save disabled while pending | AC5, AC6 |
| Component (status confirm) | SUSPEND opens `AlertDialog`; confirm fires the mutation; ACTIVE/reactivate fires without confirm | AC3, AC4 |
| Component (container) | loading→skeleton; empty (`total===0`)→empty-state; error→card; success→table+pager | AC1, edge cases |
| Component (container) | `unchanged:true`→info toast; success→`invalidateQueries` called; 404→"no existe" message | AC3, AC5, AC7 |
| Component (pager) | next advances `offset` by `limit` (guarded at `total`); prev decrements (guarded at 0) | AC2 |
| Route | `page.tsx` renders `<TenantsManagementPage/>` inside `PageContainer` | AC8 (reachable) |
| Isolation (static) | `features/tenants/` imports no `@viewpro/platform-contract` `SetTenant*Result`; all calls go through `apiRequest` | AC9, AC10 |

## Migration / Rollout

Pure additive frontend on `feat/platform-foundation`. No migration, no backend, no env change (`NEXT_PUBLIC_API_URL` already configured for Slice 1). Sub-slice A endpoints are live. Deploy = ship the `features/tenants/` module + route + nav line. Rollback = revert those files; the metrics slice and app shell are untouched.

## Open Questions (for tasks phase)

- [ ] Toast dependency: `sonner` is already a dep and `components/ui/sonner.tsx` exists — confirm a `<Toaster/>` is mounted in the app layout (Slice 1 metrics is read-only and may not have needed one). If absent, tasks must add it to `app/layout.tsx` (or fall back to inline status messaging).
- [ ] `PageContainer` prop names in viewpro-web (`pageTitle`/`pageDescription` per metrics `page.tsx`) — reuse verbatim.
- [ ] Nav icon: `listDetails` proposed; if a building/tenant glyph is preferred, register a new key in `components/icons.tsx` (small additive change).
- [ ] Page size: `limit=50` fixed (server default). Confirm whether a page-size selector is wanted now or deferred (recommend deferred — not in scope).
- [ ] Whether to also expose a "reactivate" affordance distinctly from "activate" (both target `ACTIVE`); recommend a single label derived from current status via `getTenantAction` (copy app-new).

# App-Wide Tenant Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace transient false missing-tenant UI with a centralized loading-aware active tenant resolver.

**Architecture:** Add active tenant resolution to `SessionProvider`, including fallback persistence to the existing selected-tenant store/cookie. Update tenant-scoped consumers to use `activeTenantId` and `isTenantLoading` instead of treating `!useSelectedTenantId()` as a final state.

**Tech Stack:** Next.js App Router, React client components, TanStack Query, `useSyncExternalStore`, TypeScript.

---

### Task 1: Centralize active tenant resolution

**Files:**
- Modify: `viewpro-app/apps/app-new/src/lib/session-context.tsx`

**Steps:**
1. Import `setSelectedTenantId`, `getSelectedTenantId`, `getSelectedTenantCookieId`, and `useSelectedTenantId` from `tenant-selection`.
2. Extend `SessionContextValue` with `memberships`, `selectedTenantId`, `activeMembership`, `activeTenantId`, `hasMemberships`, `isTenantLoading`, and `needsTenantSelection`.
3. Derive `activeMembership` from the stored selected tenant if valid, otherwise from the first membership.
4. Add an effect that persists the fallback active tenant when the session is loaded and the stored selection is missing/invalid, or when the BFF cookie is missing/stale.
5. Force one local rerender after writing the same selected tenant so `isTenantLoading` can clear even when the `localStorage` snapshot did not change.
6. Expose `useActiveTenant()` as a small wrapper around `useSession()`.

### Task 2: Move sidebar tenant defaulting to central resolver

**Files:**
- Modify: `viewpro-app/apps/app-new/src/components/org-switcher.tsx`

**Steps:**
1. Replace local session/selected-tenant derivation with `useActiveTenant()`.
2. Remove the sidebar-only defaulting `useEffect`.
3. Preserve manual workspace switching through `setSelectedTenantId()` and `router.refresh()`.
4. Keep loading and create-workspace sidebar states.

### Task 3: Update tenant-gated pages/components

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/activity/components/activity-monitor.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-tables/index.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-view-page.tsx`
- Modify: `viewpro-app/apps/app-new/src/app/dashboard/billing/page.tsx`

**Steps:**
1. Use `useActiveTenant()` in each component.
2. Render neutral skeleton/loading UI while `isTenantLoading` is true.
3. Enable tenant API queries only when `activeTenantId` exists and tenant loading is complete.
4. Render missing-tenant copy only after loading completes and no active tenant exists.

### Task 4: Align navigation consumers

**Files:**
- Modify: `viewpro-app/apps/app-new/src/hooks/use-nav.ts`
- Modify: `viewpro-app/apps/app-new/src/components/layout/app-sidebar.tsx`

**Steps:**
1. Use `activeMembership` for nav access checks.
2. Use centralized `hasMemberships` for membership-gated sidebar menu items.

### Task 5: Validate

**Commands:**
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter lint
pnpm --filter next-shadcn-dashboard-starter build
```

**Manual smoke:**
1. Restart the full dev stack with `pnpm dev` from `viewpro-app`.
2. Open `/dashboard/seguimiento` on a slow/reloaded browser.
3. Confirm no transient “Seleccioná una inmobiliaria” card appears.
4. Check `/dashboard/product`, product detail/new, billing, and workspace switcher.

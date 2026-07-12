# Property Agent Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let managers assign and remove sellers from a property engagement in app-new.

**Architecture:** Extend the existing property-engagement assignment API instead of introducing a new team domain. Backend adds safe duplicate handling, an unassign endpoint, and a tenant-member listing endpoint for the picker. App-new proxies those endpoints through BFF routes and renders a focused detail dialog for current/assignable sellers.

**Tech Stack:** NestJS, Prisma, Vitest, Next.js App Router, TanStack Query, React, TypeScript, shadcn/ui.

---

## Guardrails

- Branch: `feat/property-agent-assignment`.
- Keep this slice limited to property seller assignment.
- Do not change lifecycle/archive/movement behavior.
- Do not implement full team management, invitations, role editing, or owner linking.
- Do not commit without explicit maintainer approval.
- Use explicit `git add -- <paths>` only.

## Task 1: Backend duplicate-safe assignment and unassign

**Files:**

- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/remove-property-agent.use-case.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/use-cases/assign-property-agent.use-case.ts`
- Modify: `viewpro-app/apps/api/test/property-engagements.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/property-engagements.repository.spec.ts`

**Behavior:**

- `POST /property-engagements/:id/agents` remains manager/principal-manager only via `ENGAGEMENTS_CREATE`.
- Assigning a non-tenant user remains `400 BadRequestException('Agent is not a member of this tenant')`.
- Assigning a duplicate seller returns a clear conflict/bad-request result instead of leaking Prisma unique errors.
- `DELETE /property-engagements/:id/agents/:agentId` removes a `PropertyAgent` record from the engagement.
- Missing/invisible engagement or unrelated `agentId` returns `404` without leaking tenant data.
- Removing requires the same `ENGAGEMENTS_CREATE` permission as assignment.

**Validation:**

```bash
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.use-cases.spec.ts test/property-engagements.repository.spec.ts --fileParallelism=false
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
```

## Task 2: Backend assignable tenant members endpoint

**Files:**

- Modify: `viewpro-app/apps/api/src/memberships/memberships.repository.ts`
- Modify: `viewpro-app/apps/api/src/memberships/prisma-memberships.repository.ts`
- Create or modify: a small tenant/team controller endpoint under the existing API structure.
- Add tests in the closest memberships/team/auth test suite, or focused property-engagement use-case tests if no route suite exists.

**Behavior:**

- Provide an authenticated, tenant-scoped endpoint for app-new to list assignable tenant members.
- Require `TEAM_VIEW` or `ENGAGEMENTS_CREATE`.
- Return user id, email, firstName, membership role.
- MVP can include managers and agents; frontend can label roles. Do not add invitation or role editing.

**Validation:**

```bash
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.use-cases.spec.ts test/property-engagements.repository.spec.ts --fileParallelism=false
```

## Task 3: App-new BFF, service, and types

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/products/[id]/agents/route.ts`
- Create or modify: `viewpro-app/apps/app-new/src/app/api/products/assignable-agents/route.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/queries.ts`

**Behavior:**

- `GET /api/products/assignable-agents` proxies to the tenant-scoped backend member endpoint.
- `POST /api/products/:id/agents` proxies assignment payload `{ agentUserId }`.
- `DELETE /api/products/:id/agents/:agentId` proxies unassign.
- Add service methods and query keys.
- Keep BFF error translation consistent with existing product BFF routes.

**Validation:**

```bash
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

## Task 4: App-new manage sellers dialog

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/products/components/manage-property-agents-dialog.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/product-tables/columns.tsx`

**Behavior:**

- Detail view shows assigned sellers and a `Gestionar vendedores` action for active properties.
- Archived properties do not allow assignment changes and show a hint to restore first.
- Dialog lists current assigned sellers with remove buttons.
- Dialog lists assignable tenant members not already assigned.
- Assign/remove mutations refresh product detail/list queries.
- Disable controls while mutations are pending.
- Spanish product copy; no internal terms like tenant/UUID in visible UI.

**Validation:**

```bash
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter run lint
```

## Task 5: Fresh review and commit prep

**Steps:**

1. Run full targeted validation:

```bash
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.use-cases.spec.ts test/property-engagements.repository.spec.ts --fileParallelism=false
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter run lint
git diff --check
```

2. Run fresh reviewer focused on:
   - tenant isolation and permission leaks;
   - duplicate assignment handling;
   - unassign authorization;
   - no UI assignment on archived properties;
   - BFF error handling and query invalidation.
3. Ask maintainer approval before commit.

## Suggested commits

```bash
feat(api): add property seller assignment management
feat(app-new): add property seller assignment UI
```

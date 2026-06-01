# Stage 22.6 Team Member Access Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a principal manager change active member roles and deactivate tenant-scoped access from `/dashboard/users` without deleting memberships or touching global user status.

**Architecture:** Add explicit `TenantMembershipStatus` to Prisma and make tenant access checks status-aware. Add guarded backend team member mutation use cases and BFF/service/UI actions. Keep `PRINCIPAL_MANAGER` protected and keep deactivated memberships visible in the team list for audit context.

**Tech Stack:** NestJS 11, Prisma 6, Vitest, Supertest, Next.js 16 App Router, React 19, Testing Library, TanStack Query mutation, sonner toasts, pnpm.

---

## Non-negotiables

- Use `pnpm`, not Bun.
- Branch: `feat/stage-22-team-member-access`.
- Do not use global `User.status` for tenant-scoped access deactivation.
- Do not delete `TenantMembership` rows for deactivation.
- Do not allow `PRINCIPAL_MANAGER` role assignment, role change, or deactivation.
- Do not allow self-deactivation.
- All target membership lookup must be scoped by selected `tenantId`.
- `TenantMembershipGuard` must reject deactivated memberships.
- `/auth/me` must not return deactivated memberships.
- Deactivated members remain visible in `/team/members` with status.
- Keep reactivation, principal transfer, user/trial limits, and automatic reassignment out of scope.
- Do not commit, push, open PRs, or delete branches unless explicitly approved during execution.

## Task 1: Add tenant membership status schema migration

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_tenant_membership_status/migration.sql`

**Step 1: Update Prisma schema**

Add enum near `TenantRole`:

```prisma
enum TenantMembershipStatus {
  ACTIVE
  DEACTIVATED
}
```

Update `TenantMembership`:

```prisma
model TenantMembership {
  id                  String                 @id @default(uuid())
  userId              String
  tenantId            String
  role                TenantRole
  status              TenantMembershipStatus @default(ACTIVE)
  deactivatedAt       DateTime?
  deactivatedByUserId String?
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([userId])
  @@map("tenant_memberships")
}
```

Do not add a relation for `deactivatedByUserId` in this slice unless Prisma relation naming gets messy. Store actor id as scalar audit metadata.

**Step 2: Generate migration**

Use the repo's existing Prisma workflow. If no helper exists, run from repo root:

```bash
pnpm --dir viewpro-app --filter @viewpro/api prisma migrate dev --name add_tenant_membership_status --create-only
```

Expected: new migration SQL that:

- creates enum `TenantMembershipStatus`;
- adds `status` with default `ACTIVE`;
- adds nullable `deactivatedAt` and `deactivatedByUserId`;
- adds index `(tenantId, status)`.

**Step 3: Generate Prisma client if needed**

```bash
pnpm --dir viewpro-app --filter @viewpro/api prisma generate
```

Expected: generated client supports `TenantMembershipStatus`.

## Task 2: Extend membership repository for active access and scoped updates

**Files:**
- Modify: `viewpro-app/apps/api/src/memberships/memberships.repository.ts`
- Modify: `viewpro-app/apps/api/src/memberships/prisma-memberships.repository.ts`
- Modify/create relevant tests if membership repository tests exist; otherwise cover through use-case/e2e tests.

**Step 1: Extend repository interface**

Add methods:

```ts
findActiveByUserIdAndTenantId(userId: string, tenantId: string): Promise<MembershipWithUserAndTenant | null>
findActiveManyByUserId(userId: string): Promise<MembershipWithTenant[]>
findByIdForTenant(membershipId: string, tenantId: string): Promise<MembershipWithUserAndTenant | null>
updateRoleForTenant(input: {
  membershipId: string
  tenantId: string
  role: TenantRole.MANAGER | TenantRole.AGENT
}): Promise<MembershipWithUserAndTenant>
deactivateForTenant(input: {
  membershipId: string
  tenantId: string
  actorUserId: string
  now?: Date
}): Promise<MembershipWithUserAndTenant | null>
```

Keep existing methods temporarily if other code uses them.

**Step 2: Implement active filters**

`findActiveByUserIdAndTenantId` and `findActiveManyByUserId` must filter:

```ts
status: TenantMembershipStatus.ACTIVE
```

`findByIdForTenant` should include inactive rows because team list/actions need to report state.

`deactivateForTenant` should be race-safe:

1. `updateMany` where `{ id, tenantId, status: ACTIVE }` to set `DEACTIVATED` fields.
2. If count is `0`, return `null`.
3. Fetch and return updated membership with user/tenant includes.

**Step 3: Run typecheck**

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: may fail until downstream call sites switch to active methods. Fix in Task 3.

## Task 3: Make auth/session/guard active-membership aware

**Files:**
- Modify: `viewpro-app/apps/api/src/tenant-context/tenant-membership.guard.ts`
- Modify: `viewpro-app/apps/api/src/auth/use-cases/get-current-user.use-case.ts`
- Modify: `viewpro-app/apps/api/test/auth.e2e-spec.ts` or existing auth/me tests if present
- Modify: `viewpro-app/apps/api/test/team.e2e-spec.ts` if auth test coverage lives there

**Step 1: Write RED e2e/use-case tests**

Test:

- `/auth/me` omits deactivated memberships.
- guarded tenant endpoint with deactivated membership returns `403`.
- stale selected tenant behavior is frontend-side, but backend should clearly deny deactivated `x-tenant-id`.

Command candidates:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/auth.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: fail before active filtering is implemented.

**Step 2: Update guard**

Use `findActiveByUserIdAndTenantId` instead of unfiltered lookup.

Keep existing checks:

- user global status active;
- tenant not suspended/cancelled;
- role permissions mapped into `TenantContext`.

**Step 3: Update `/auth/me`**

Use `findActiveManyByUserId` so inactive memberships disappear from session projection.

**Step 4: Run tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/auth.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS after fixes.

## Task 4: Extend team member response contract

**Files:**
- Modify: `viewpro-app/apps/api/src/team/responses/team-member.response.ts` or current team member response file
- Modify: `viewpro-app/apps/api/src/team/use-cases/list-team-members.use-case.ts`
- Modify: `viewpro-app/apps/api/test/team.use-cases.spec.ts`

**Step 1: Add response fields**

Extend team member response with:

```ts
membershipStatus: 'ACTIVE' | 'DEACTIVATED'
deactivatedAt: string | null
deactivatedByUserId: string | null
```

Mapper should return ISO strings for dates.

**Step 2: Preserve list semantics**

`GET /team/members` should include active and deactivated memberships for selected tenant.

Sort active first, then newest or existing order. If existing order is created date, keep it unless product tests require active-first.

**Step 3: Test list response**

Add test that deactivated membership appears with status and metadata, and no password/hash/unrelated membership data leaks.

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
```

Expected: PASS.

## Task 5: Add backend role update use case and endpoint

**Files:**
- Create: `viewpro-app/apps/api/src/team/dto/update-team-member-role.dto.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/update-team-member-role.use-case.ts`
- Modify: `viewpro-app/apps/api/src/team/team.controller.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`
- Modify: `viewpro-app/apps/api/test/team.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/team.e2e-spec.ts`

**Step 1: DTO**

```ts
import { IsIn } from 'class-validator'
import { TenantRole } from '@prisma/client'

export const UPDATE_TEAM_MEMBER_ROLES = [TenantRole.MANAGER, TenantRole.AGENT] as const

export class UpdateTeamMemberRoleDto {
  @IsIn(UPDATE_TEAM_MEMBER_ROLES)
  role!: (typeof UPDATE_TEAM_MEMBER_ROLES)[number]
}
```

**Step 2: RED use-case tests**

Cover:

- success updating active non-principal member to `MANAGER` or `AGENT`;
- missing `TEAM_MANAGE` throws `ForbiddenException`;
- target from another tenant returns `NotFoundException`;
- inactive target rejects;
- target `PRINCIPAL_MANAGER` rejects;
- requested `PRINCIPAL_MANAGER` rejects defensively even if DTO is bypassed.

**Step 3: Implement use case**

Use existing team helper permission pattern.

Pseudo-flow:

```ts
ensureTeamManagePermission(tenant)
if (input.role === TenantRole.PRINCIPAL_MANAGER) throw new BadRequestException(...)
const membership = await membershipsRepository.findByIdForTenant(membershipId, tenant.tenantId)
if (!membership) throw new NotFoundException(...)
if (membership.status !== TenantMembershipStatus.ACTIVE) throw new BadRequestException(...)
if (membership.role === TenantRole.PRINCIPAL_MANAGER) throw new BadRequestException(...)
const updated = await membershipsRepository.updateRoleForTenant(...)
return toTeamMemberResponse(updated)
```

**Step 4: Controller endpoint**

Add:

```ts
@Patch('members/:membershipId/role')
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
updateMemberRole(...)
```

Import `Patch` and DTO.

**Step 5: E2E tests**

Cover auth, tenant, permission, validation, cross-tenant, principal protection, and successful list response update.

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: PASS.

## Task 6: Add backend deactivate use case and endpoint

**Files:**
- Create: `viewpro-app/apps/api/src/team/use-cases/deactivate-team-member.use-case.ts`
- Modify: `viewpro-app/apps/api/src/team/team.controller.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`
- Modify: `viewpro-app/apps/api/test/team.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/team.e2e-spec.ts`

**Step 1: RED tests**

Cover:

- success deactivates active non-principal target;
- response includes `membershipStatus: 'DEACTIVATED'`, `deactivatedAt`, `deactivatedByUserId`;
- missing `TEAM_MANAGE` rejects;
- target from other tenant returns not found;
- target already deactivated rejects or returns current state — choose reject with `BadRequestException` for clearer UX;
- principal manager target rejects;
- current requester self-deactivation rejects;
- deactivated user no longer sees tenant in `/auth/me` and cannot access guarded tenant endpoint.

**Step 2: Implement use case**

Pseudo-flow:

```ts
ensureTeamManagePermission(tenant)
const membership = await membershipsRepository.findByIdForTenant(membershipId, tenant.tenantId)
if (!membership) throw new NotFoundException(...)
if (membership.userId === currentUser.userId) throw new BadRequestException(...)
if (membership.role === TenantRole.PRINCIPAL_MANAGER) throw new BadRequestException(...)
if (membership.status !== TenantMembershipStatus.ACTIVE) throw new BadRequestException(...)
const updated = await membershipsRepository.deactivateForTenant({ membershipId, tenantId, actorUserId: currentUser.userId })
if (!updated) throw new BadRequestException(...)
return toTeamMemberResponse(updated)
```

**Step 3: Controller endpoint**

Add:

```ts
@Post('members/:membershipId/deactivate')
@HttpCode(HttpStatus.OK)
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
deactivateMember(...)
```

**Step 4: Run tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 7: Update property assignment active-member behavior

**Files:**
- Modify: `viewpro-app/apps/api/src/property-engagements/use-cases/list-assignable-property-agents.use-case.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/use-cases/assign-property-agent.use-case.ts`
- Modify repository methods if needed: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Modify relevant tests under `viewpro-app/apps/api/test/property-engagements*.spec.ts`

**Step 1: RED tests**

Cover:

- deactivated memberships do not appear in assignable agents;
- globally suspended users do not appear in assignable agents;
- assigning a deactivated member fails;
- existing assignments are not deleted by deactivation.

**Step 2: Implement active filters**

Use membership status and user status filters. Preserve existing role eligibility in this slice unless a current test already expects only `AGENT`.

**Step 3: Run focused tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.use-cases.spec.ts
```

Adjust exact file names based on repo.

Expected: PASS.

## Task 8: Add app-new BFF routes

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/team/members/[membershipId]/role/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/members/[membershipId]/role/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/members/[membershipId]/deactivate/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/members/[membershipId]/deactivate/route.test.ts`

**Step 1: RED route tests**

Role route:

- proxies `PATCH` to `/team/members/:membershipId/role`;
- forwards JSON body;
- Spanish fallback: `No se pudo actualizar el rol.`

Deactivate route:

- proxies `POST` to `/team/members/:membershipId/deactivate`;
- Spanish fallback: `No se pudo desactivar el acceso.`

**Step 2: Implement routes**

Use existing `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse` patterns.

Role example:

```ts
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params
  try {
    const response = await bffFetch(`/team/members/${encodeURIComponent(membershipId)}/role`, {
      method: 'PATCH',
      body: await request.text(),
    })
    return proxyJsonResponse(response)
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo actualizar el rol.')
  }
}
```

**Step 3: Run tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/team/members/[membershipId]/role/route.test.ts' 'src/app/api/team/members/[membershipId]/deactivate/route.test.ts'
```

Expected: PASS.

## Task 9: Extend app-new users service/types

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`

**Step 1: Types**

Add:

```ts
export type TenantMembershipStatus = 'ACTIVE' | 'DEACTIVATED'

export type UpdateTeamMemberRolePayload = {
  role: Extract<TenantRole, 'MANAGER' | 'AGENT'>
}
```

Extend `User` with:

```ts
membershipStatus: TenantMembershipStatus
deactivatedAt: string | null
deactivatedByUserId: string | null
```

**Step 2: Service methods**

Add:

```ts
export async function updateTeamMemberRole(
  membershipId: string,
  payload: UpdateTeamMemberRolePayload,
): Promise<User> { ... }

export async function deactivateTeamMember(membershipId: string): Promise<User> { ... }
```

Use BFF paths:

```ts
/api/team/members/${encodeURIComponent(membershipId)}/role
/api/team/members/${encodeURIComponent(membershipId)}/deactivate
```

**Step 3: Tests**

Cover paths, methods, request body, JSON parsing, and error handling.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts
```

Expected: PASS.

## Task 10: Update team members UI for status and actions

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx`
- Modify/create a small role action component if needed.

**Step 1: Component API**

Extend props:

```ts
type TeamMembersListProps = {
  canManageTeam?: boolean
  currentMembershipId?: string | null
  members: User[]
  isUpdatingRoleMembershipId?: string | null
  isDeactivatingMembershipId?: string | null
  onUpdateRole?: (membershipId: string, role: 'MANAGER' | 'AGENT') => void
  onDeactivate?: (membershipId: string) => void
}
```

**Step 2: UI behavior**

Render:

- role badge;
- membership status badge (`Activo`, `Desactivado`);
- action selector/buttons only when:
  - `canManageTeam`;
  - member is active;
  - member is not `PRINCIPAL_MANAGER`;
  - member is not current membership for deactivate.

Keep UI simple. A select for next role plus a deactivate button is enough. Avoid confirmation dialog unless existing project pattern makes it cheap; otherwise use a clear destructive button and tests.

**Step 3: Tests**

Cover:

- status badges render;
- no actions without permission;
- no actions for `PRINCIPAL_MANAGER`;
- no self-deactivate action;
- role update callback receives membership id and role;
- deactivate callback receives membership id.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-members-list.test.tsx
```

Expected: PASS.

## Task 11: Wire TeamManagementSection mutations

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.test.tsx`
- Maybe modify: `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx` if current membership id/permissions need to be passed from server; otherwise use session context in client component.

**Step 1: Get current permissions**

Use existing session context hook if available:

```ts
const { activeMembership } = useActiveTenant()
const canManageTeam = activeMembership?.permissions.includes('team.manage') ?? false
```

If this hook is not available in client component, pass `canManageTeam` and `currentMembershipId` from server page using existing session helpers.

**Step 2: Add mutations**

Use `useMutation` for:

- `updateTeamMemberRole`;
- `deactivateTeamMember`.

On success:

- replace member in local state with response;
- toast success:
  - `Rol actualizado.`
  - `Acceso desactivado.`

On error:

- toast backend/user message or fallback.

**Step 3: Tests**

Cover:

- can manage team actions displayed;
- role update calls service and updates list;
- deactivation calls service and shows deactivated badge;
- errors show toast and do not mutate local state;
- pending invitation behavior from Stage 22.5 still works.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-management-section.test.tsx
```

Expected: PASS.

## Task 12: Focused validation

Run backend checks:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts test/team-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Run app-new checks:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/team/members/[membershipId]/role/route.test.ts' 'src/app/api/team/members/[membershipId]/deactivate/route.test.ts'
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts src/features/users/components/team-members-list.test.tsx src/features/users/components/team-management-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

Run final repo checks:

```bash
git diff --check
```

Expected: all pass. If exact test filenames differ, locate with `find viewpro-app/apps/api/test -maxdepth 1 -type f | sort` and run the closest focused suites.

## Task 13: Fresh review before completion

Ask a fresh-context reviewer to inspect:

- migration safety and default active state;
- tenant-scoped access enforcement;
- `/auth/me` excluding deactivated memberships;
- principal-manager protection;
- self-deactivation protection;
- cross-tenant mutation safety;
- property assignment active-member filtering;
- app-new action gating and backend-source-of-truth enforcement;
- no scope creep into reactivation, principal transfer, user limits, or automatic reassignment.

Fix confirmed blockers only.

## Task 14: Stop for user confirmation

Summarize:

- files changed;
- migration created;
- validation evidence;
- fresh review result;
- remaining non-goals;
- review size forecast.

Do not create PR, push, merge, or delete branches without explicit user confirmation.

## Suggested work-unit commits if commit-approved

1. `docs(team): plan member access management`
2. `feat(api): add tenant membership access state`
3. `feat(api): manage team member access`
4. `feat(app-new): manage team member access`

Keep tests with the behavior they verify.

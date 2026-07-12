# Stage 22.1 Real Team List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fake `app-new` users path with a tenant-scoped, permission-guarded, read-only real team list backed by `TenantMembership + User`.

**Architecture:** Add a dedicated NestJS `TeamModule` exposing `GET /team/members`, guarded by auth, tenant context, and `TEAM_VIEW`. Keep the existing `app-new` compatibility route `GET /api/users`, but make it proxy to `/team/members`; update the users service and `/dashboard/users` UI to consume the real read-only response. Unsupported user mutations return honest unsupported responses and no longer mutate fake data.

**Tech Stack:** NestJS 11, Prisma, Vitest, Supertest, Next.js 16 App Router route handlers, React 19, pnpm.

---

## Non-negotiables

- Use pnpm, not Bun.
- Keep this slice read-only.
- Do not add invitations, role changes, deactivation, user limits, phone/contact fields, or property-agent behavior changes.
- Backend is the security boundary: tenant-scoped, auth-guarded, permission-guarded.
- Do not expose `passwordHash`, `globalRole`, or cross-tenant user data.
- App-new `POST /api/users`, `PUT /api/users/:id`, and `DELETE /api/users/:id` must not mutate fake in-memory users.
- Run API e2e suites sequentially; they share a local Postgres test DB.

## Task 1: Backend team listing use case — RED

**Files:**
- Create: `viewpro-app/apps/api/test/team.use-cases.spec.ts`
- Later create: `viewpro-app/apps/api/src/team/use-cases/list-team-members.use-case.ts`

**Step 1: Write failing use-case tests**

Create `team.use-cases.spec.ts` with tests for response mapping, tenant repository input, safe fields, and defense-in-depth permission checks.

```ts
import { ForbiddenException } from '@nestjs/common';
import { TenantRole, TenantStatus, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../src/permissions/permissions.constants';
import { ListTeamMembersUseCase } from '../src/team/use-cases/list-team-members.use-case';
import type { TenantContext } from '../src/tenant-context/tenant-context.types';

const tenant: TenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  tenantStatus: TenantStatus.ACTIVE,
  membershipId: 'membership-current',
  role: TenantRole.MANAGER,
  permissions: [PERMISSIONS.TEAM_VIEW],
  userStatus: UserStatus.ACTIVE
};

describe('ListTeamMembersUseCase', () => {
  it('maps tenant memberships to safe team member responses', async () => {
    const membershipsRepository = {
      findManyByTenantId: vi.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          role: TenantRole.MANAGER,
          createdAt: new Date('2026-05-01T10:00:00.000Z'),
          updatedAt: new Date('2026-05-02T10:00:00.000Z'),
          user: {
            id: 'user-1',
            email: 'manager@example.com',
            passwordHash: 'secret',
            firstName: 'Ana',
            lastName: 'Gómez',
            status: UserStatus.ACTIVE,
            globalRole: 'USER'
          },
          tenant: {
            id: 'tenant-1',
            name: 'Tenant One',
            slug: 'tenant-one',
            status: TenantStatus.ACTIVE
          }
        }
      ])
    };

    const useCase = new ListTeamMembersUseCase(membershipsRepository as never);

    await expect(useCase.execute(tenant)).resolves.toEqual({
      items: [
        {
          membershipId: 'membership-1',
          userId: 'user-1',
          email: 'manager@example.com',
          firstName: 'Ana',
          lastName: 'Gómez',
          userStatus: UserStatus.ACTIVE,
          role: TenantRole.MANAGER,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    });

    expect(membershipsRepository.findManyByTenantId).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects listing without TEAM_VIEW permission', async () => {
    const membershipsRepository = { findManyByTenantId: vi.fn() };
    const useCase = new ListTeamMembersUseCase(membershipsRepository as never);

    await expect(
      useCase.execute({ ...tenant, permissions: [PERMISSIONS.TENANT_VIEW] })
    ).rejects.toThrow(new ForbiddenException('Insufficient permissions'));

    expect(membershipsRepository.findManyByTenantId).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
```

Expected: FAIL because `../src/team/use-cases/list-team-members.use-case` does not exist.

## Task 2: Backend team listing use case — GREEN

**Files:**
- Create: `viewpro-app/apps/api/src/team/use-cases/list-team-members.use-case.ts`

**Step 1: Implement the minimal use case**

```ts
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { TenantRole, UserStatus } from '@prisma/client';
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
  type MembershipWithUserAndTenant
} from '../../memberships/memberships.repository';
import { PERMISSIONS } from '../../permissions/permissions.constants';
import type { TenantContext } from '../../tenant-context/tenant-context.types';

export type TeamMemberResponse = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  userStatus: UserStatus;
  role: TenantRole;
  createdAt: string;
  updatedAt: string;
};

export type TeamMembersResponse = {
  items: TeamMemberResponse[];
};

@Injectable()
export class ListTeamMembersUseCase {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository
  ) {}

  async execute(tenant: TenantContext): Promise<TeamMembersResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.TEAM_VIEW)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const memberships = await this.membershipsRepository.findManyByTenantId(tenant.tenantId);

    return {
      items: memberships.map(mapTeamMember)
    };
  }
}

function mapTeamMember(membership: MembershipWithUserAndTenant): TeamMemberResponse {
  return {
    membershipId: membership.id,
    userId: membership.userId,
    email: membership.user.email,
    firstName: membership.user.firstName,
    lastName: membership.user.lastName,
    userStatus: membership.user.status,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString()
  };
}
```

**Step 2: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
```

Expected: PASS.

**Step 3: Commit**

```bash
git add viewpro-app/apps/api/test/team.use-cases.spec.ts \
  viewpro-app/apps/api/src/team/use-cases/list-team-members.use-case.ts
git commit -m "feat(api): add team member listing use case"
```

## Task 3: Backend controller/module e2e — RED

**Files:**
- Create: `viewpro-app/apps/api/test/team.e2e-spec.ts`
- Later create: `viewpro-app/apps/api/src/team/team.controller.ts`
- Later create: `viewpro-app/apps/api/src/team/team.module.ts`
- Later modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Write endpoint tests**

Use existing e2e setup patterns from `tenant-context.e2e-spec.ts` and `property-engagements.e2e-spec.ts`.

Cover:

- `GET /api/team/members` requires tenant context.
- A principal/manager with `TEAM_VIEW` can list selected tenant members.
- An `AGENT` membership is rejected because it lacks `TEAM_VIEW`.
- The response does not include sensitive fields.

Use `request.agent(app.getHttpServer())` to preserve auth cookies from `POST /api/auth/register-tenant`.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: FAIL with 404 for `/api/team/members`.

## Task 4: Backend controller/module — GREEN

**Files:**
- Create: `viewpro-app/apps/api/src/team/team.controller.ts`
- Create: `viewpro-app/apps/api/src/team/team.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Add controller**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import { CurrentTenant } from '../tenant-context/current-tenant.decorator';
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator';
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard';
import type { TenantContext } from '../tenant-context/tenant-context.types';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';

@Controller('team')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly listTeamMembersUseCase: ListTeamMembersUseCase) {}

  @Get('members')
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  listMembers(@CurrentTenant() tenant: TenantContext) {
    return this.listTeamMembersUseCase.execute(tenant);
  }
}
```

**Step 2: Add module**

```ts
import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { TeamController } from './team.controller';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';

@Module({
  imports: [MembershipsModule],
  controllers: [TeamController],
  providers: [ListTeamMembersUseCase]
})
export class TeamModule {}
```

**Step 3: Register module**

Add `TeamModule` to `viewpro-app/apps/api/src/app.module.ts` imports.

**Step 4: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add viewpro-app/apps/api/src/app.module.ts \
  viewpro-app/apps/api/src/team \
  viewpro-app/apps/api/test/team.e2e-spec.ts
git commit -m "feat(api): expose tenant team members endpoint"
```

## Task 5: App-new users BFF tests — RED

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/users/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/users/[id]/route.test.ts`
- Later modify: `viewpro-app/apps/app-new/src/app/api/users/route.ts`
- Later modify: `viewpro-app/apps/app-new/src/app/api/users/[id]/route.ts`

**Step 1: Test `GET /api/users` proxy and unsupported `POST`**

Mock `@/lib/bff-api` and assert:

- `GET` calls `bffFetch('/team/members')`.
- `POST` returns `501` and does not call backend mutation or fake storage.

**Step 2: Test unsupported `PUT`/`DELETE`**

Assert `PUT` and `DELETE` under `/api/users/[id]` return `501`.

**Step 3: Run RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/app/api/users/route.test.ts \
  src/app/api/users/[id]/route.test.ts
```

Expected: FAIL because the routes still import and mutate `fakeUsers`.

## Task 6: App-new users BFF — GREEN

**Files:**
- Modify: `viewpro-app/apps/app-new/src/app/api/users/route.ts`
- Modify: `viewpro-app/apps/app-new/src/app/api/users/[id]/route.ts`

**Step 1: Replace collection route**

Use the existing BFF helper pattern from product routes.

```ts
import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const response = await bffFetch('/team/members');
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar el equipo.');
  }
}

export async function POST(_request: NextRequest) {
  return unsupportedUserMutationResponse();
}

function unsupportedUserMutationResponse() {
  return NextResponse.json(
    {
      message:
        'User mutations are not supported yet. Team invitations and role changes are planned for a later Stage 22 slice.'
    },
    { status: 501 }
  );
}
```

**Step 2: Replace `[id]` route**

Return the same unsupported response for `PUT` and `DELETE`.

**Step 3: Run GREEN**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/app/api/users/route.test.ts \
  src/app/api/users/[id]/route.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add viewpro-app/apps/app-new/src/app/api/users
git commit -m "feat(app-new): proxy users BFF to team members"
```

## Task 7: Frontend users service tests — RED

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`
- Later modify: `viewpro-app/apps/app-new/src/features/users/api/service.ts`
- Later modify: `viewpro-app/apps/app-new/src/features/users/api/types.ts`

**Step 1: Write service test**

Test that `getUsers()` fetches `/api/users`, parses the real team-member shape, and uses `cache: 'no-store'` plus `credentials: 'include'`.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/features/users/api/service.test.ts
```

Expected: FAIL because service still imports `fakeUsers`.

## Task 8: Frontend users service/types — GREEN

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.ts`

**Step 1: Replace fake types with real team member types**

```ts
export type TenantRole = 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT';
export type TeamUserStatus = 'ACTIVE' | 'SUSPENDED';

export type User = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  userStatus: TeamUserStatus;
  role: TenantRole;
  createdAt: string;
  updatedAt: string;
};

export type UserFilters = {
  page?: number;
  limit?: number;
  roles?: string;
  search?: string;
  sort?: string;
};

export type UsersResponse = {
  items: User[];
};

export type UserMutationPayload = Record<string, never>;
```

**Step 2: Replace service implementation**

Implement `getUsers()` with same-origin fetch to `/api/users`, timeout, `credentials: 'include'`, and `cache: 'no-store'`. Keep `createUser`, `updateUser`, and `deleteUser` as explicit unsupported functions that throw until later Stage 22 slices.

**Step 3: Run GREEN**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/features/users/api/service.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/users/api/types.ts \
  viewpro-app/apps/app-new/src/features/users/api/service.ts \
  viewpro-app/apps/app-new/src/features/users/api/service.test.ts
git commit -m "feat(app-new): load users from real team endpoint"
```

## Task 9: Read-only team UI tests — RED

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx`
- Later create: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx`
- Later modify: `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`

**Step 1: Write UI component tests**

Test that the list renders:

- full name;
- email;
- role;
- status;
- empty state;
- no create/edit/delete controls.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/features/users/components/team-members-list.test.tsx
```

Expected: FAIL because the component does not exist.

## Task 10: Read-only team UI — GREEN

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx`
- Modify: `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`

**Step 1: Add simple read-only component**

Prefer a small domain-specific table/list over adapting the old fake CRUD table.

The component should render columns:

- Name;
- Email;
- Role;
- Status;
- Member since.

Use existing UI primitives such as `Badge` and simple existing table classes. Do not add new shared primitives or global CSS.

**Step 2: Update dashboard page**

Replace the pending card with async real data:

```tsx
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsers } from '@/features/users/api/service';
import { TeamMembersList } from '@/features/users/components/team-members-list';

export const metadata = {
  title: 'Dashboard: Users'
};

export default async function UsersPage() {
  const team = await getUsers();

  return (
    <PageContainer pageTitle='Users' pageDescription='Read-only team members for the selected tenant.'>
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            This list is backed by real tenant memberships. Invitations and role changes are planned
            for a later Stage 22 slice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={team.items} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
```

Adjust copy only if the surrounding dashboard convention prefers Spanish; do not introduce fake actions.

**Step 3: Run GREEN**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/features/users/components/team-members-list.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx \
  viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx \
  viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx
git commit -m "feat(app-new): show read-only real team list"
```

## Task 11: Fake users import cleanup

**Files:**
- Modify/delete only if needed:
  - `viewpro-app/apps/app-new/src/features/users/components/users-table/*`
  - `viewpro-app/apps/app-new/src/features/users/components/user-form-sheet.tsx`
  - `viewpro-app/apps/app-new/src/features/users/api/mutations.ts`
  - `viewpro-app/apps/app-new/src/constants/mock-api-users.ts`

**Step 1: Check remaining fake imports**

```bash
rg "fakeUsers|mock-api-users" viewpro-app/apps/app-new/src/app/api/users viewpro-app/apps/app-new/src/features/users
```

Expected: no output for active users route/service paths.

**Step 2: Keep diff small**

Do not adapt old fake CRUD table unless typecheck/build fails. If stale fake-only files break typecheck because `User` types changed, neutralize or remove only the failing unused files.

**Step 3: Build before cleanup decisions**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

Expected: PASS. If it fails on stale fake user components, do the smallest cleanup needed and commit:

```bash
git add viewpro-app/apps/app-new/src/features/users viewpro-app/apps/app-new/src/constants/mock-api-users.ts
git commit -m "chore(app-new): remove stale fake user management code"
```

## Task 12: Full validation

**Step 1: Backend targeted validation**

Run API tests sequentially:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

**Step 2: App-new targeted validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/app/api/users/route.test.ts \
  src/app/api/users/[id]/route.test.ts \
  src/features/users/api/service.test.ts \
  src/features/users/components/team-members-list.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

**Step 3: Fake import regression check**

```bash
rg "fakeUsers|mock-api-users" viewpro-app/apps/app-new/src/app/api/users viewpro-app/apps/app-new/src/features/users || true
```

Expected: no output.

**Step 4: Static checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint \
  src/app/api/users/route.ts \
  src/app/api/users/[id]/route.ts \
  src/features/users/api/service.ts \
  src/features/users/api/service.test.ts \
  src/features/users/components/team-members-list.tsx \
  src/features/users/components/team-members-list.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check \
  src/app/api/users/route.ts \
  src/app/api/users/[id]/route.ts \
  src/features/users/api/service.ts \
  src/features/users/api/service.test.ts \
  src/features/users/components/team-members-list.tsx \
  src/features/users/components/team-members-list.test.tsx
git diff --check
```

## Task 13: Fresh review and PR preparation

**Step 1: Fresh review**

Ask a fresh-context reviewer to check:

- backend tenant scoping and `TEAM_VIEW` guard correctness;
- no sensitive fields in team responses;
- BFF uses existing `bffFetch` forwarding behavior;
- fake mutations no longer mutate;
- `/dashboard/users` has no create/edit/delete controls;
- existing property-agent assignment behavior is unchanged.

**Step 2: Issue and PR**

Create an approved issue:

```txt
feat(team): show real read-only team list
```

Labels:

```txt
enhancement
status:approved
```

Open PR to `develop` with exactly one `type:*` label:

```txt
type:feature
```

**Step 3: Review workload guard**

Forecast: likely over 400 changed lines because this is a vertical backend+BFF+UI+tests slice. If final diff exceeds 400 lines, ask the user for explicit size-exception approval before opening PR, or split into chained PRs:

1. backend `GET /team/members`;
2. app-new BFF/service conversion;
3. read-only `/dashboard/users` UI and fake cleanup.

## Files to modify

Backend:

- `viewpro-app/apps/api/src/app.module.ts`
- new `viewpro-app/apps/api/src/team/team.module.ts`
- new `viewpro-app/apps/api/src/team/team.controller.ts`
- new `viewpro-app/apps/api/src/team/use-cases/list-team-members.use-case.ts`
- new `viewpro-app/apps/api/test/team.use-cases.spec.ts`
- new `viewpro-app/apps/api/test/team.e2e-spec.ts`

App-new:

- `viewpro-app/apps/app-new/src/app/api/users/route.ts`
- `viewpro-app/apps/app-new/src/app/api/users/[id]/route.ts`
- `viewpro-app/apps/app-new/src/features/users/api/types.ts`
- `viewpro-app/apps/app-new/src/features/users/api/service.ts`
- `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`
- `viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx`
- `viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx`
- `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`

Optional cleanup only if needed:

- `viewpro-app/apps/app-new/src/features/users/components/users-table/*`
- `viewpro-app/apps/app-new/src/features/users/components/user-form-sheet.tsx`
- `viewpro-app/apps/app-new/src/features/users/api/mutations.ts`
- `viewpro-app/apps/app-new/src/constants/mock-api-users.ts`

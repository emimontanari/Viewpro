# Stage 22.5 Pending Team Invitations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let managers view pending team invitations on `/dashboard/users`, regenerate and copy a fresh link, and revoke invitations that should no longer be usable.

**Architecture:** Extend the guarded backend `/team/invitations` management API with a pending-list endpoint requiring `TEAM_MANAGE`. Extend app-new BFF/service/types and add a pending invitations section to the existing team management page. Preserve token security by never listing raw tokens or `tokenHash`; copy-link behavior uses resend/rotation to create a fresh URL.

**Tech Stack:** NestJS 11, Prisma 6, Vitest, Supertest, Next.js 16 App Router, React 19, Testing Library, TanStack Query mutation, sonner toasts, pnpm.

---

## Non-negotiables

- Use `pnpm`, not Bun.
- Branch: `feat/stage-22-pending-invitations`.
- Do not persist or expose raw invitation tokens.
- Do not return `tokenHash` or `invitationUrl` from `GET /team/invitations`.
- `GET /team/invitations` must require `TEAM_MANAGE`.
- List only pending, unexpired invitations.
- “Copy link” means “regenerate and copy fresh link”; previous pending link becomes invalid through existing resend behavior.
- Keep this slice focused: no email delivery, expired list, pagination, history, bulk import, role changes, or member deactivation.
- Do not commit, push, open PRs, or delete branches unless explicitly approved during execution.

## Task 1: Add backend pending invitation response contract

**Files:**
- Modify: `viewpro-app/apps/api/src/team/responses/team-invitation.response.ts`

**Step 1: Add response types**

Add safe pending-list response types beside the existing invitation response mappers:

```ts
export type PendingTeamInvitationResponse = {
  invitationId: string
  email: string
  role: TeamInvitationRole
  status: Extract<TeamInvitationStatus, 'PENDING'>
  expiresAt: string
  createdAt: string
  invitedByUserId: string
}

export type PendingTeamInvitationsResponse = {
  items: PendingTeamInvitationResponse[]
}
```

**Step 2: Add mapper**

```ts
export function toPendingTeamInvitationResponse(
  invitation: Pick<
    TeamInvitation,
    'id' | 'email' | 'role' | 'status' | 'expiresAt' | 'createdAt' | 'invitedByUserId'
  >,
): PendingTeamInvitationResponse {
  return {
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role as TeamInvitationRole,
    status: invitation.status as Extract<TeamInvitationStatus, 'PENDING'>,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    invitedByUserId: invitation.invitedByUserId,
  }
}
```

**Step 3: Typecheck**

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 2: Add repository list contract and repository tests

**Files:**
- Modify: `viewpro-app/apps/api/src/team/team-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/test/team-invitations.repository.spec.ts`

**Step 1: Extend repository type**

Add method:

```ts
listPendingInvitations(input: {
  tenantId: string
  now?: Date
}): Promise<TeamInvitation[]>
```

Use `TeamInvitation` import already present in the repository contract.

**Step 2: Write RED repository tests**

Add tests for:

- returns only pending, unexpired invitations for the selected tenant;
- excludes expired invitations;
- excludes revoked invitations;
- excludes accepted invitations;
- excludes other-tenant invitations;
- orders newest first;
- returned objects include safe fields needed by mapper but no raw token field.

Suggested command:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected before implementation: FAIL because `listPendingInvitations` does not exist.

## Task 3: Implement Prisma list method

**Files:**
- Modify: `viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts`

**Step 1: Implement method**

Add to `PrismaTeamInvitationsRepository`:

```ts
listPendingInvitations(input: { tenantId: string; now?: Date }) {
  const now = input.now ?? new Date()

  return this.prisma.teamInvitation.findMany({
    where: {
      tenantId: input.tenantId,
      status: TeamInvitationStatus.PENDING,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

Do not include or return raw token; it is not persisted.

**Step 2: Run repository tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected: PASS.

## Task 4: Add list use case and use-case tests

**Files:**
- Create: `viewpro-app/apps/api/src/team/use-cases/list-team-invitations.use-case.ts`
- Modify: `viewpro-app/apps/api/test/team-invitations.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`

**Step 1: Write RED use-case tests**

Test:

- requires `TEAM_MANAGE` via `ensureTeamManagePermission`;
- calls repository with selected tenant id;
- maps repository invitations to `{ items }` safe response;
- response does not contain `tokenHash`, raw token, or `invitationUrl`.

Command:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
```

Expected: FAIL until use case exists.

**Step 2: Implement use case**

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { toPendingTeamInvitationResponse } from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { ensureTeamManagePermission } from './team-invitation-use-case-helpers'

@Injectable()
export class ListTeamInvitationsUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
  ) {}

  async execute(tenant: TenantContext) {
    ensureTeamManagePermission(tenant)
    const invitations = await this.teamInvitationsRepository.listPendingInvitations({
      tenantId: tenant.tenantId,
    })
    return { items: invitations.map(toPendingTeamInvitationResponse) }
  }
}
```

**Step 3: Register provider**

In `team.module.ts`, add `ListTeamInvitationsUseCase` to providers.

**Step 4: Run use-case tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
```

Expected: PASS.

## Task 5: Add backend controller endpoint and e2e coverage

**Files:**
- Modify: `viewpro-app/apps/api/src/team/team.controller.ts`
- Modify: `viewpro-app/apps/api/test/team-invitations.e2e-spec.ts`

**Step 1: Write RED e2e tests**

Add tests for `GET /api/team/invitations`:

- unauthenticated request returns `401`;
- request without tenant context returns existing tenant guard error (`403` expected based on current patterns);
- user without `TEAM_MANAGE` returns `403`;
- principal manager can list pending invitations;
- list excludes expired/revoked/accepted and other-tenant rows;
- response excludes `tokenHash`, raw token, and `invitationUrl`.

Command:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
```

Expected: FAIL until endpoint exists.

**Step 2: Wire controller**

Inject `ListTeamInvitationsUseCase` into `TeamController` constructor and add:

```ts
@Get('invitations')
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
listInvitations(@CurrentTenant() tenant: TenantContext) {
  return this.listTeamInvitationsUseCase.execute(tenant)
}
```

Make sure imports include `Get` if not already present and preserve existing endpoints.

**Step 3: Run e2e and regression tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: PASS.

## Task 6: Extend app-new BFF route for list

**Files:**
- Modify: `viewpro-app/apps/app-new/src/app/api/team/invitations/route.ts`
- Modify: `viewpro-app/apps/app-new/src/app/api/team/invitations/route.test.ts`

**Step 1: Write RED route test**

Add test:

- `GET /api/team/invitations` proxies to backend `/team/invitations` with method `GET`;
- returns backend JSON response;
- maps BFF errors to Spanish fallback: `No se pudieron cargar las invitaciones.`

Command:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts
```

Expected: FAIL until `GET` export exists.

**Step 2: Implement GET**

```ts
export async function GET() {
  try {
    const response = await bffFetch('/team/invitations', { method: 'GET' })
    return proxyJsonResponse(response)
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las invitaciones.')
  }
}
```

Keep existing `POST` unchanged.

**Step 3: Run BFF test**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts
```

Expected: PASS.

## Task 7: Add app-new resend/revoke BFF routes

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/[id]/resend/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/[id]/resend/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/[id]/revoke/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/[id]/revoke/route.test.ts`

**Step 1: Write RED tests**

For each action route, test:

- proxies `POST` to `/team/invitations/:id/resend` or `/team/invitations/:id/revoke`;
- returns backend JSON;
- Spanish fallback on proxy error.

Suggested fallbacks:

- resend: `No se pudo regenerar la invitación.`
- revoke: `No se pudo revocar la invitación.`

Commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/[id]/resend/route.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/[id]/revoke/route.test.ts
```

**Step 2: Implement routes**

Use the same `bffFetch`, `proxyJsonResponse`, `proxyBffErrorResponse` pattern as create route.

Example resend:

```ts
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const response = await bffFetch(`/team/invitations/${encodeURIComponent(id)}/resend`, {
      method: 'POST',
    })
    return proxyJsonResponse(response)
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo regenerar la invitación.')
  }
}
```

Mirror for revoke.

**Step 3: Run action route tests**

Expected: PASS.

## Task 8: Extend app-new users API service/types

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`

**Step 1: Add types**

```ts
export type PendingTeamInvitation = {
  invitationId: string
  email: string
  role: TeamInvitationRole
  status: 'PENDING'
  expiresAt: string
  createdAt: string
  invitedByUserId: string
}

export type PendingTeamInvitationsResponse = {
  items: PendingTeamInvitation[]
}
```

Reuse `TeamInvitationLinkResponse` for resend and `TeamInvitationResponse` for revoke if already available; otherwise add a safe revoke response type matching backend.

**Step 2: Write RED service tests**

Test:

- `getTeamInvitations()` calls `/api/team/invitations` with `GET` and parses response;
- `resendTeamInvitation(id)` calls `/api/team/invitations/:id/resend` with `POST` and returns link response;
- `revokeTeamInvitation(id)` calls `/api/team/invitations/:id/revoke` with `POST` and returns revoke response.

Command:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts
```

Expected: FAIL until service methods exist.

**Step 3: Implement service methods**

Add constants:

```ts
const teamInvitationActionPath = (id: string, action: 'resend' | 'revoke') =>
  `${TEAM_INVITATIONS_API_PATH}/${encodeURIComponent(id)}/${action}`
```

Add methods:

```ts
export async function getTeamInvitations(
  init?: UsersRequestInit,
): Promise<PendingTeamInvitationsResponse> { ... }

export async function resendTeamInvitation(id: string): Promise<TeamInvitationLinkResponse> { ... }

export async function revokeTeamInvitation(id: string): Promise<TeamInvitationResponse> { ... }
```

Use existing `apiFetch` and `parseJsonResponse` patterns.

**Step 4: Run service tests**

Expected: PASS.

## Task 9: Add pending invitations component

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/components/pending-team-invitations-list.tsx`
- Create: `viewpro-app/apps/app-new/src/features/users/components/pending-team-invitations-list.test.tsx`

**Step 1: Write RED component tests**

Test:

- renders empty state;
- renders email, role label, and expiration for pending invitations;
- clicking `Regenerar y copiar link` calls callback with invitation id;
- clicking `Revocar` calls callback with invitation id;
- displays visible fallback link when provided after clipboard failure.

Keep this component mostly presentational to keep tests simple.

**Step 2: Implement component**

Props:

```ts
type PendingTeamInvitationsListProps = {
  copiedInvitationUrl: string | null
  invitations: PendingTeamInvitation[]
  isRegeneratingInvitationId?: string | null
  isRevokingInvitationId?: string | null
  onRegenerateAndCopy: (invitationId: string) => void
  onRevoke: (invitationId: string) => void
}
```

UI:

- Use `Card` or a nested section consistent with `TeamManagementSection`.
- Prefer a simple responsive list/table similar to `TeamMembersList`.
- Button labels in Spanish:
  - `Regenerar y copiar link`
  - `Revocar`
- Format date with `es-AR` locale.

**Step 3: Run component test**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/pending-team-invitations-list.test.tsx
```

Expected: PASS.

## Task 10: Wire dashboard data loading and mutations

**Files:**
- Modify: `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.test.tsx`

**Step 1: Update server page**

Load members and pending invitations in parallel after computing tenant headers:

```ts
const headers = await getTeamRequestHeaders()
const [team, invitations] = await Promise.all([
  getUsers({}, { headers }),
  getTeamInvitations({ headers }),
])

<TeamManagementSection members={team.items} pendingInvitations={invitations.items} />
```

**Step 2: Write/update section tests**

Test:

- renders members and pending invitations;
- create invitation success can append or refresh pending list state;
- resend action calls `resendTeamInvitation`, copies returned URL, refreshes/replaces list state;
- clipboard failure shows visible fallback link;
- revoke action calls `revokeTeamInvitation` and removes item;
- API errors show toast error and do not remove item.

Mock `createTeamInvitation`, `resendTeamInvitation`, `revokeTeamInvitation`, and `sonner`.

**Step 3: Implement client state**

`TeamManagementSection` should accept:

```ts
type TeamManagementSectionProps = {
  members: User[]
  pendingInvitations: PendingTeamInvitation[]
}
```

Maintain local pending invitation state:

```ts
const [pendingInvitationsState, setPendingInvitationsState] = useState(pendingInvitations)
const [copiedInvitationUrl, setCopiedInvitationUrl] = useState<string | null>(null)
```

When create invitation succeeds, add/replace the returned pending invitation if enough fields exist. Since create response lacks `createdAt`/`invitedByUserId`, simplest safe behavior is to show manual link in dialog and not update pending list until page refresh. However Stage 22.5 UX benefits from list update.

Recommended minimal approach:

- Do not synthesize new pending-list item from create response.
- For resend/revoke, update local state because the action target is already in the list.
- If product needs create-to-list immediate update, add `createdAt`/`invitedByUserId` to create response in a separate backend contract change.

For resend:

- call `resendTeamInvitation(id)`;
- remove old id from local list;
- optionally add a minimal replacement only if the response shape has all needed fields; if not, remove old item and show copied link, with copy explaining the fresh link was generated.

Better Stage 22.5 approach: after resend, call `getTeamInvitations()` client-side to refresh list. This avoids inventing missing fields and handles new invitation id.

Implement a `refreshPendingInvitations` helper that calls `getTeamInvitations()` and updates state after resend/revoke.

**Step 4: Run section test**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-management-section.test.tsx
```

Expected: PASS.

## Task 11: Focused validation

Run all focused checks:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts src/app/api/team/invitations/[id]/resend/route.test.ts src/app/api/team/invitations/[id]/revoke/route.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts src/features/users/components/pending-team-invitations-list.test.tsx src/features/users/components/team-management-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

Expected: all pass.

## Task 12: Fresh review before completion

Ask a fresh-context reviewer to inspect:

- `TEAM_MANAGE` enforcement for list;
- tenant scoping and expired/revoked/accepted exclusion;
- no token/hash/link leakage in list response;
- resend/copy clearly rotates link;
- revoke removes item safely;
- app-new BFF forwards tenant headers;
- tests cover backend, BFF, service, and UI behavior;
- no accidental scope creep into email delivery or token persistence.

Fix confirmed blockers only.

## Task 13: Stop for user confirmation

Summarize:

- files changed;
- validation evidence;
- fresh review result;
- remaining non-goals;
- review size forecast.

Do not create PR, push, merge, or delete branches without explicit user confirmation.

## Suggested work-unit commits if commit-approved

1. `docs(team): plan pending team invitations`
2. `feat(api): list pending team invitations`
3. `feat(app-new): manage pending team invitations`

Keep tests with the behavior they verify.

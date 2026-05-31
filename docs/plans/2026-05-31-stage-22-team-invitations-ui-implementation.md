# Stage 22.3 Team Invitation UI/BFF Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let managers create a team invitation from `/dashboard/users`, proxy the request through app-new, and copy or manually retrieve the generated invitation link.

**Architecture:** Keep `/dashboard/users` as a server component that loads real team members. Add an explicit app-new BFF route at `POST /api/team/invitations`, a typed users service function, and a small client-side team management section that owns the invite dialog, mutation, clipboard copy, and manual link fallback.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, Radix/shadcn UI components, TanStack Query mutation, sonner toasts, pnpm.

---

## Non-negotiables

- Use `pnpm`, not Bun.
- Keep this PR focused on Stage 22.3 UI/BFF invitation creation.
- Do not add public team invitation acceptance.
- Do not add email delivery.
- Do not add pending invitation listing, resend UI, or revoke UI.
- Do not use `POST /api/users` for invitation creation; use `POST /api/team/invitations`.
- The UI must only offer `MANAGER` and `AGENT` invite roles.
- The team list should remain backed by `/team/members` and should not refresh after invite creation unless a future pending-invite list exists.
- Clipboard copy failure is not an invite failure; show the manual link fallback.
- Do not open a PR without explicit user confirmation.

## Task 1: Add explicit team invitation BFF route

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/team/invitations/route.test.ts`

**Step 1: Write RED route tests**

Create `viewpro-app/apps/app-new/src/app/api/team/invitations/route.test.ts`:

```ts
import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((_error: unknown, message: string) =>
    Response.json({ message }, { status: 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
};

describe('team invitations BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(invitationResponse), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('proxies POST to the backend team invitations endpoint', async () => {
    const body = { email: 'agente@example.com', role: 'AGENT' };

    const response = await POST(
      new NextRequest('http://localhost/api/team/invitations', {
        body: JSON.stringify(body),
        method: 'POST'
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(invitationResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/invitations', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(
      new NextRequest('http://localhost/api/team/invitations', {
        body: JSON.stringify({ email: 'agente@example.com', role: 'AGENT' }),
        method: 'POST'
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo crear la invitación.'
    });
  });
});
```

**Step 2: Run the test and verify failure**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts
```

Expected: FAIL because `./route` does not exist.

**Step 3: Implement the route**

Create `viewpro-app/apps/app-new/src/app/api/team/invitations/route.ts`:

```ts
import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = await bffFetch('/team/invitations', {
      body: await request.text(),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo crear la invitación.');
  }
}
```

**Step 4: Run the test and verify pass**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add viewpro-app/apps/app-new/src/app/api/team/invitations/route.ts \
  viewpro-app/apps/app-new/src/app/api/team/invitations/route.test.ts
git commit -m "feat(app-new): proxy team invitation creation"
```

## Task 2: Add typed frontend invitation service

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`

**Step 1: Write RED service test**

Modify imports in `service.test.ts`:

```ts
import {
  createTeamInvitation,
  createUser,
  deleteUser,
  getUsers,
  updateUser
} from './service';
```

Add fixture near `teamMembersResponse`:

```ts
const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
};
```

Add test before unsupported mutation test:

```ts
it('creates a team invitation through the explicit team invitations BFF route', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(invitationResponse), {
      headers: { 'content-type': 'application/json' },
      status: 201
    })
  );
  vi.stubGlobal('fetch', fetchMock);

  await expect(
    createTeamInvitation({ email: 'agente@example.com', role: 'AGENT' })
  ).resolves.toEqual(invitationResponse);

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/team/invitations',
    expect.objectContaining({
      body: JSON.stringify({ email: 'agente@example.com', role: 'AGENT' }),
      cache: 'no-store',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: expect.any(AbortSignal)
    })
  );
});
```

**Step 2: Run the test and verify failure**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts
```

Expected: FAIL because `createTeamInvitation` is not exported.

**Step 3: Add types**

Modify `viewpro-app/apps/app-new/src/features/users/api/types.ts`:

```ts
export type TeamInvitationRole = Extract<TenantRole, 'MANAGER' | 'AGENT'>;

export type CreateTeamInvitationPayload = {
  email: string;
  role: TeamInvitationRole;
};

export type TeamInvitationLinkResponse = {
  invitationId: string;
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING';
  expiresAt: string;
  invitationUrl: string;
};
```

Keep `UserMutationPayload = Record<string, never>` for unsupported user CRUD.

**Step 4: Add service function**

Modify `viewpro-app/apps/app-new/src/features/users/api/service.ts` imports:

```ts
import type {
  CreateTeamInvitationPayload,
  TeamInvitationLinkResponse,
  UserFilters,
  UserMutationPayload,
  UsersResponse
} from './types';
```

Add constant:

```ts
const TEAM_INVITATIONS_API_PATH = '/api/team/invitations';
```

Add function after `getUsers`:

```ts
export async function createTeamInvitation(
  data: CreateTeamInvitationPayload
): Promise<TeamInvitationLinkResponse> {
  const response = await apiFetch(TEAM_INVITATIONS_API_PATH, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<TeamInvitationLinkResponse>(response);
}
```

**Step 5: Run the test and verify pass**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/users/api/types.ts \
  viewpro-app/apps/app-new/src/features/users/api/service.ts \
  viewpro-app/apps/app-new/src/features/users/api/service.test.ts
git commit -m "feat(app-new): add team invitation service"
```

## Task 3: Add invite dialog component

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/components/invite-team-member-dialog.tsx`
- Create: `viewpro-app/apps/app-new/src/features/users/components/invite-team-member-dialog.test.tsx`

**Step 1: Write RED dialog tests**

Create `invite-team-member-dialog.test.tsx` with tests for validation and submit payload:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';

function renderDialog(overrides = {}) {
  const props = {
    invitationUrl: null,
    isSubmitting: false,
    onInviteAnother: vi.fn(),
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    open: true,
    ...overrides
  };

  render(<InviteTeamMemberDialog {...props} />);
  return props;
}

describe('InviteTeamMemberDialog', () => {
  it('requires a valid email', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(await screen.findByText('El email es obligatorio.')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/email/i), 'no-es-email');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits a normalized email and selected role', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.type(screen.getByLabelText(/email/i), ' AGENTE@Example.COM ');
    await user.click(screen.getByRole('combobox', { name: /rol/i }));
    await user.click(screen.getByRole('option', { name: /manager/i }));
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      email: 'agente@example.com',
      role: 'MANAGER'
    });
  });

  it('shows the generated manual invitation link', () => {
    renderDialog({ invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1' });

    expect(screen.getByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'http://localhost:3000/team-invitations/raw-token-1' })
    ).toHaveAttribute('href', 'http://localhost:3000/team-invitations/raw-token-1');
  });
});
```

Adjust accessible role queries if Radix Select renders differently in the local test environment.

**Step 2: Run and verify failure**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/invite-team-member-dialog.test.tsx
```

Expected: FAIL because component does not exist.

**Step 3: Implement dialog**

Create `invite-team-member-dialog.tsx` using these imports:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useEffect, useState, type FormEvent } from 'react';
import type { CreateTeamInvitationPayload, TeamInvitationRole } from '../api/types';
```

Use state and validation:

```tsx
const INITIAL_FORM: CreateTeamInvitationPayload = {
  email: '',
  role: 'AGENT'
};

const ROLE_OPTIONS: Array<{ label: string; value: TeamInvitationRole }> = [
  { label: 'Agente', value: 'AGENT' },
  { label: 'Manager', value: 'MANAGER' }
];

type FieldErrors = Partial<Record<keyof CreateTeamInvitationPayload, string>>;
```

Component contract:

```tsx
type InviteTeamMemberDialogProps = {
  invitationUrl: string | null;
  isSubmitting: boolean;
  onInviteAnother: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTeamInvitationPayload) => void;
  open: boolean;
};
```

Behavior:

- Reset form/errors when `open` becomes false.
- Submit trims/lowercases email.
- Validate email and role.
- Render the manual link block only when `invitationUrl` exists.
- Show an `Invitar otra persona` button when `invitationUrl` exists.
- Disable submit while `isSubmitting`.

Validation helpers:

```ts
function validatePayload(payload: CreateTeamInvitationPayload) {
  const errors: FieldErrors = {};

  if (!payload.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!isValidEmail(payload.email)) {
    errors.email = 'Ingresá un email válido.';
  }

  if (!ROLE_OPTIONS.some((option) => option.value === payload.role)) {
    errors.role = 'Seleccioná un rol válido.';
  }

  return errors;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
```

**Step 4: Run and fix tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/invite-team-member-dialog.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/users/components/invite-team-member-dialog.tsx \
  viewpro-app/apps/app-new/src/features/users/components/invite-team-member-dialog.test.tsx
git commit -m "feat(app-new): add team invite dialog"
```

## Task 4: Wire team management section into `/dashboard/users`

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.tsx`
- Create: `viewpro-app/apps/app-new/src/features/users/components/team-management-section.test.tsx`
- Modify: `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`

**Step 1: Write RED section tests**

Mock `createTeamInvitation` and `sonner`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeamInvitation } from '../api/service';
import { TeamManagementSection } from './team-management-section';

vi.mock('../api/service', () => ({
  createTeamInvitation: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}));

const createTeamInvitationMock = vi.mocked(createTeamInvitation);
const members = [
  {
    membershipId: 'membership-1',
    userId: 'user-1',
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Gómez',
    userStatus: 'ACTIVE',
    role: 'MANAGER',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z'
  } as const
];

const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
} as const;

describe('TeamManagementSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    createTeamInvitationMock.mockResolvedValue(invitationResponse);
  });

  it('renders existing team members and opens the invite dialog', async () => {
    const user = userEvent.setup();
    render(<TeamManagementSection members={[...members]} />);

    expect(screen.getByText('ana@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(screen.getByRole('dialog', { name: /invitar miembro/i })).toBeInTheDocument();
  });

  it('creates an invitation and copies the returned link', async () => {
    const user = userEvent.setup();
    render(<TeamManagementSection members={[...members]} />);

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    await waitFor(() => {
      expect(createTeamInvitationMock).toHaveBeenCalledWith({
        email: 'agente@example.com',
        role: 'AGENT'
      });
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(invitationResponse.invitationUrl);
    expect(screen.getByRole('link', { name: invitationResponse.invitationUrl })).toBeInTheDocument();
  });

  it('keeps the manual link visible when clipboard copy fails', async () => {
    const user = userEvent.setup();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('blocked'));
    render(<TeamManagementSection members={[...members]} />);

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(await screen.findByRole('link', { name: invitationResponse.invitationUrl })).toBeInTheDocument();
  });

  it('shows API errors without a manual link', async () => {
    const user = userEvent.setup();
    createTeamInvitationMock.mockRejectedValueOnce(new Error('Forbidden'));
    render(<TeamManagementSection members={[...members]} />);

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    await waitFor(() => {
      expect(screen.queryByText('Copiá este link manualmente:')).not.toBeInTheDocument();
    });
  });
});
```

Adjust toast assertions if useful, but keep the tests focused on user-visible state and service calls.

**Step 2: Run and verify failure**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-management-section.test.tsx
```

Expected: FAIL because `TeamManagementSection` does not exist.

**Step 3: Implement team management section**

Create `team-management-section.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { createTeamInvitation } from '../api/service';
import type { CreateTeamInvitationPayload, User } from '../api/types';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';
import { TeamMembersList } from './team-members-list';

type TeamManagementSectionProps = {
  members: User[];
};

export function TeamManagementSection({ members }: TeamManagementSectionProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [manualInvitationUrl, setManualInvitationUrl] = useState<string | null>(null);
  const inviteMutation = useMutation({
    mutationFn: (payload: CreateTeamInvitationPayload) => createTeamInvitation(payload),
    onSuccess: async (response) => {
      setManualInvitationUrl(response.invitationUrl);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Invitación creada y link copiado.');
      } catch {
        toast.warning('Invitación creada. Copiá el link manualmente.');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la invitación.');
    }
  });

  function handleOpenInviteDialog() {
    setManualInvitationUrl(null);
    setInviteDialogOpen(true);
  }

  function handleInviteAnother() {
    setManualInvitationUrl(null);
    inviteMutation.reset();
  }

  return (
    <>
      <Card>
        <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Esta lista usa membresías reales del tenant. Creá una invitación para sumar un
              manager o agente.
            </CardDescription>
          </div>
          <Button type='button' onClick={handleOpenInviteDialog}>
            Invitar miembro
          </Button>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={members} />
        </CardContent>
      </Card>
      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        invitationUrl={manualInvitationUrl}
        isSubmitting={inviteMutation.isPending}
        onInviteAnother={handleInviteAnother}
        onOpenChange={setInviteDialogOpen}
        onSubmit={(payload) => inviteMutation.mutate(payload)}
      />
    </>
  );
}
```

**Step 4: Wire the server page**

Modify `viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx`:

- Replace `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, and `TeamMembersList` imports with:

```ts
import { TeamManagementSection } from '@/features/users/components/team-management-section';
```

- Replace the card JSX with:

```tsx
<TeamManagementSection members={team.items} />
```

Keep `getTeamRequestHeaders()` unchanged.

**Step 5: Run section test and fix**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-management-section.test.tsx
```

Expected: PASS.

**Step 6: Run all touched app-new tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts src/features/users/api/service.test.ts src/features/users/components/invite-team-member-dialog.test.tsx src/features/users/components/team-management-section.test.tsx
```

Expected: PASS.

**Step 7: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/users/components/team-management-section.tsx \
  viewpro-app/apps/app-new/src/features/users/components/team-management-section.test.tsx \
  viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx
git commit -m "feat(app-new): add team invitation UI"
```

## Task 5: Polish visible team table copy if tests reveal template English

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx`
- Add/modify: `viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx` if no existing coverage exercises copy.

**Step 1: Inspect current copy**

The current table uses English headings (`Name`, `Role`, `Status`, `Member since`) and empty-state copy (`No team members`). If the new Stage 22.3 UI feels inconsistent, localize the table copy in the same PR because it is part of the visible team management page.

Suggested Spanish labels:

- `No hay miembros del equipo`
- `No se encontraron miembros para el tenant seleccionado.`
- `Nombre`
- `Email`
- `Rol`
- `Estado`
- `Miembro desde`
- date locale `es-AR`

**Step 2: Add a small test if needed**

If no test already covers `TeamMembersList`, add a focused test asserting one heading and empty-state copy.

**Step 3: Implement copy-only changes**

Keep behavior unchanged.

**Step 4: Run focused tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-members-list.test.tsx
```

Expected: PASS.

**Step 5: Commit if changed**

```bash
git add viewpro-app/apps/app-new/src/features/users/components/team-members-list.tsx \
  viewpro-app/apps/app-new/src/features/users/components/team-members-list.test.tsx
git commit -m "fix(app-new): localize team members list"
```

Skip this task if the user prefers no copy polish beyond the invitation UI.

## Task 6: Final validation and fresh review

**Files:**
- No expected source changes unless validation reveals issues.

**Step 1: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts src/features/users/api/service.test.ts src/features/users/components/invite-team-member-dialog.test.tsx src/features/users/components/team-management-section.test.tsx
```

Expected: PASS.

If Task 5 was implemented, include:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-members-list.test.tsx
```

**Step 2: Run typecheck**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

Expected: PASS.

**Step 3: Run diff hygiene**

```bash
git diff --check
```

Expected: no output.

**Step 4: Run LSP diagnostics**

Use Pi LSP diagnostics on touched app-new files. Expected: 0 diagnostics.

**Step 5: Run fresh review**

Ask a fresh reviewer to inspect the diff for:

- explicit BFF route and no `POST /api/users` overload;
- no token persistence or tokenHash exposure in app-new;
- invite roles limited to `MANAGER` and `AGENT`;
- clipboard fallback visible;
- tests sufficient;
- scope remains Stage 22.3 only.

**Step 6: Stop for user confirmation**

Do not create issue/PR automatically. Report status and ask whether to add anything else first.

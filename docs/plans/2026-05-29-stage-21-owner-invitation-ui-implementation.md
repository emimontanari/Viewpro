# Stage 21.3 Owner Invitation Acceptance UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public app-new invitation acceptance page that validates an owner invitation token, lets the invited owner set credentials, and redirects them to `/owner` after acceptance.

**Architecture:** Add a focused `features/owner-invitations` client feature that composes existing app-new form/card/alert/button primitives. The route `/owner-invitations/[token]` stays public and passes the raw token to a client view, which calls the existing backend endpoints through the shared `apiRequest` helper.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, zod, existing TanStack form wrappers, Vitest, Testing Library, existing app-new UI components.

---

## Non-negotiables

- Reuse existing UI components and styles only.
- Do not create new shared design-system components, global CSS, or visual variants.
- Keep the raw token only in the route param and API calls.
- Do not log the token, put it in query params, or include it in redirects.
- Redirect successful acceptance to `/owner`, not `/dashboard`.
- Keep existing-user acceptance out of scope; show the backend `409` guidance with a sign-in link.

## Task 1: Add owner invitation API client

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/owner-invitations/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/owner-invitations/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/owner-invitations/api/service.test.ts`

**Step 1: Write failing service tests**

Create `service.test.ts` with tests that stub `fetch` and prove the public endpoints are called through `apiRequest`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptOwnerInvitation, getOwnerInvitation } from './service';
import type { OwnerInvitationResponse } from './types';

const invitation: OwnerInvitationResponse = {
  id: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
  ownerFirstName: 'Ana',
  ownerLastName: 'García',
  property: {
    id: 'property-1',
    title: 'Casa Palermo',
    addressLine: 'Uriarte 1234',
    city: 'CABA',
    province: 'Buenos Aires'
  },
  expiresAt: '2026-06-01T10:00:00.000Z'
};

describe('owner invitation API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches invitation metadata without caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitation), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getOwnerInvitation('raw token/value')).resolves.toEqual(invitation);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/owner-invitations/raw%20token%2Fvalue',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'GET'
      })
    );
  });

  it('accepts an invitation and returns the auth session', async () => {
    const validCredential = 'test-credential-123';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            firstName: 'Ana',
            lastName: 'García',
            status: 'ACTIVE',
            globalRole: 'USER'
          },
          memberships: []
        }),
        { headers: { 'content-type': 'application/json' }, status: 201 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      acceptOwnerInvitation('token-1', {
        firstName: 'Ana',
        lastName: 'García',
        password: validCredential
      })
    ).resolves.toMatchObject({ memberships: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/owner-invitations/token-1/accept',
      expect.objectContaining({
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'García',
          password: validCredential
        }),
        credentials: 'include',
        headers: expect.any(Headers),
        method: 'POST'
      })
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/api/service.test.ts
```

Expected: FAIL because `./service` and `./types` do not exist.

**Step 3: Add types**

Create `types.ts`:

```ts
export type OwnerInvitationProperty = {
  id: string;
  title: string;
  addressLine: string;
  city: string;
  province: string;
};

export type OwnerInvitationResponse = {
  id: string;
  propertyAssetOwnerId: string;
  email: string;
  ownerFirstName: string;
  ownerLastName: string;
  property: OwnerInvitationProperty;
  expiresAt: string;
};

export type AcceptOwnerInvitationInput = {
  firstName: string;
  lastName?: string;
  password: string;
};
```

**Step 4: Add service implementation**

Create `service.ts`:

```ts
import { apiRequest } from '@/lib/api-client';
import type { Session } from '@/lib/session';
import type { AcceptOwnerInvitationInput, OwnerInvitationResponse } from './types';

export function getOwnerInvitation(token: string) {
  return apiRequest<OwnerInvitationResponse>(`/owner-invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    method: 'GET'
  });
}

export function acceptOwnerInvitation(token: string, input: AcceptOwnerInvitationInput) {
  return apiRequest<Session>(`/owner-invitations/${encodeURIComponent(token)}/accept`, {
    body: input,
    method: 'POST'
  });
}
```

**Step 5: Run service tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/api/service.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/owner-invitations/api
git commit -m "feat(owners): add owner invitation app client"
```

## Task 2: Build the acceptance view with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx`

**Step 1: Write failing component tests**

Mock the API service and `next/navigation`. Keep tests focused on visible behavior and submit flow.

```ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { acceptOwnerInvitation, getOwnerInvitation } from '../api/service';
import type { OwnerInvitationResponse } from '../api/types';
import { OwnerInvitationAcceptanceView } from './owner-invitation-acceptance-view';

vi.mock('../api/service', () => ({
  acceptOwnerInvitation: vi.fn(),
  getOwnerInvitation: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

const getOwnerInvitationMock = vi.mocked(getOwnerInvitation);
const acceptOwnerInvitationMock = vi.mocked(acceptOwnerInvitation);

const invitation: OwnerInvitationResponse = {
  id: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
  ownerFirstName: 'Ana',
  ownerLastName: 'García',
  property: {
    id: 'property-1',
    title: 'Casa Palermo',
    addressLine: 'Uriarte 1234',
    city: 'CABA',
    province: 'Buenos Aires'
  },
  expiresAt: '2026-06-01T10:00:00.000Z'
};

describe('OwnerInvitationAcceptanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerInvitationMock.mockResolvedValue(invitation);
    acceptOwnerInvitationMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: invitation.email,
        firstName: 'Ana',
        lastName: 'García',
        status: 'ACTIVE',
        globalRole: 'USER'
      },
      memberships: []
    });
  });

  it('renders the valid invitation and prefilled editable owner fields', async () => {
    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText('Casa Palermo')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
    expect(screen.getByLabelText('Apellido')).toHaveValue('García');
  });

  it('accepts the invitation and redirects to the owner portal', async () => {
    const validCredential = 'test-credential-123';
    const user = userEvent.setup();
    render(<OwnerInvitationAcceptanceView token='token-1' />);

    await user.clear(await screen.findByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Anita');
    await user.type(screen.getByLabelText('Contraseña'), validCredential);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta y entrar' }));

    await waitFor(() => {
      expect(acceptOwnerInvitationMock).toHaveBeenCalledWith('token-1', {
        firstName: 'Anita',
        lastName: 'García',
        password: validCredential
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/owner');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows existing-user guidance with a sign-in link', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(apiError(409, 'Owner email is already registered'));

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/ya está registrado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute(
      'href',
      '/auth/sign-in'
    );
  });

  it('shows expired invitation guidance', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(apiError(410, 'Owner invitation has expired'));

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/expiró/i)).toBeInTheDocument();
  });
});

function apiError(status: number, message: string): ApiError {
  return { status, message };
}
```

Add more test cases after the base implementation if needed:

- `404` invalid link;
- `410` already accepted;
- client validation for blank first name and weak password.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: FAIL because the component does not exist.

**Step 3: Implement the component**

Create `owner-invitation-acceptance-view.tsx` as a client component. Use existing auth-page composition and form primitives:

```ts
'use client';

import * as React from 'react';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { InteractiveGridPattern } from '@/features/auth/components/interactive-grid';
import { acceptOwnerInvitation, getOwnerInvitation } from '../api/service';
import type { OwnerInvitationResponse } from '../api/types';

type OwnerInvitationAcceptanceViewProps = {
  token: string;
};

type AcceptanceValues = {
  firstName: string;
  lastName: string;
  password: string;
};

const acceptanceSchema = z.object({
  firstName: z.string().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

export function OwnerInvitationAcceptanceView({ token }: OwnerInvitationAcceptanceViewProps) {
  const router = useRouter();
  const [invitation, setInvitation] = React.useState<OwnerInvitationResponse | null>(null);
  const [loadError, setLoadError] = React.useState<unknown>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    getOwnerInvitation(token)
      .then((response) => {
        if (!cancelled) {
          setInvitation(response);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error);
          setInvitation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/auth/sign-in'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 md:top-8 md:right-8'
        )}
      >
        Iniciar sesión
      </Link>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <BrandPanel />
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-xl flex-col items-center justify-center space-y-6'>
          {isLoading ? <LoadingCard /> : null}
          {!isLoading && loadError ? <InvitationErrorCard error={loadError} /> : null}
          {!isLoading && invitation ? (
            <AcceptanceCard
              invitation={invitation}
              onSubmit={async (value) => {
                setSubmitError(null);
                try {
                  await acceptOwnerInvitation(token, {
                    firstName: value.firstName,
                    lastName: value.lastName || undefined,
                    password: value.password
                  });
                  router.push('/owner');
                  router.refresh();
                } catch (error) {
                  setSubmitError(getApiErrorMessage(error));
                }
              }}
              submitError={submitError}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

The snippet above is intentionally incomplete. Finish it by adding small local helper components in the same file only:

- `BrandPanel` using the same ViewPro sidebar pattern as `sign-in-view.tsx`;
- `LoadingCard` with `Card`, `CardHeader`, `CardContent`;
- `InvitationErrorCard` with status-specific Spanish copy and optional sign-in link;
- `AcceptanceCard` with `useAppForm`, `useFormFields`, property summary, editable name fields, password field, and submit button.

Do not export the local helpers unless tests need direct access.

**Step 4: Run component tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: PASS.

**Step 5: Add missing edge tests if implementation gaps appear**

Add tests for:

```ts
it('shows invalid-link guidance for 404', async () => {});
it('shows already-accepted guidance for 410 already accepted', async () => {});
it('prevents submitting without a first name', async () => {});
it('prevents submitting with a weak password', async () => {});
```

Run the same component test command until PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/owner-invitations/components
git commit -m "feat(owners): add invitation acceptance view"
```

## Task 3: Add the public App Router page

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.tsx`
- Optionally create test: `viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.test.tsx`

**Step 1: Add the route page**

Create `page.tsx`:

```ts
import type { Metadata } from 'next';
import { OwnerInvitationAcceptanceView } from '@/features/owner-invitations/components/owner-invitation-acceptance-view';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: 'Aceptar invitación | ViewPro',
  description: 'Aceptá tu invitación para acceder al portal de propietarios de ViewPro.',
  robots: {
    follow: false,
    index: false
  }
};

export default async function OwnerInvitationPage({ params }: PageProps) {
  const { token } = await params;

  return <OwnerInvitationAcceptanceView token={token} />;
}
```

**Step 2: Run focused tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/api/service.test.ts src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: PASS.

**Step 3: Commit**

```bash
git add viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.tsx
git commit -m "feat(owners): add invitation acceptance route"
```

## Task 4: Validate the app-new slice

**Files:**
- Review: `viewpro-app/apps/app-new/src/features/owner-invitations/**`
- Review: `viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.tsx`

**Step 1: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner-invitations/api/service.test.ts src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: PASS.

**Step 2: Run full app-new test suite**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test
```

Expected: PASS.

**Step 3: Run lint**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter lint
```

Expected: PASS.

**Step 4: Run build**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

Expected: PASS.

**Step 5: Run whitespace check**

```bash
git diff --check
```

Expected: no output.

**Step 6: Run LSP diagnostics on changed app-new files**

Use Pi LSP diagnostics on:

```txt
viewpro-app/apps/app-new/src/features/owner-invitations/api/service.ts
viewpro-app/apps/app-new/src/features/owner-invitations/api/types.ts
viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx
viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.tsx
```

Expected: no TypeScript diagnostics.

## Task 5: Fresh review and PR preparation

**Files:**
- All files changed in this branch.

**Step 1: Inspect branch diff**

```bash
git status --short --branch
git diff --stat develop..HEAD
git diff --name-status develop..HEAD
```

Expected: branch contains only Stage 21.3 design/plan docs and app-new invitation UI files.

**Step 2: Run fresh reviewer**

Ask a fresh reviewer to audit:

- route remains public;
- token is not leaked into logs, query params, or redirects;
- existing components/styles are reused;
- success redirects to `/owner`;
- error states are clear;
- tests cover service and component behavior.

**Step 3: Fix only confirmed blockers**

If the reviewer finds blockers, apply the smallest safe fix and rerun affected tests.

**Step 4: Create approved GitHub issue**

Create an issue like:

```txt
feat(owners): add owner invitation acceptance UI
```

Include scope, out-of-scope items, and verification checklist. Add `enhancement` and `status:approved` labels.

**Step 5: Open PR to develop**

Open PR from `feat/stage-21-owner-invitation-ui` to `develop`.

PR body must include:

- `Closes #<issue-number>`;
- exactly one type checkbox: New feature;
- exactly one PR label: `type:feature`;
- summary;
- changed files table;
- test plan;
- out-of-scope list.

## Review budget forecast

This slice may exceed the 400-line review guard if component tests are comprehensive. Keep it as one PR only if the diff stays focused on:

- one public page;
- one feature API client;
- one feature view;
- focused tests;
- design/plan docs.

If the app-new diff grows into broader auth/session refactors or shared UI work, stop and split before opening the PR.

# ProductForm Owner Section Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract owner card/dialog/invitation orchestration from `product-form.tsx` into a focused `PropertyOwnerSection` component without changing behavior.

**Architecture:** `product-form.tsx` remains the container for non-owner detail behavior. `PropertyOwnerSection` owns only owner-specific UI orchestration: `PropertyOwnerCard`, `LinkPropertyOwnerDialog`, link-owner mutation, invitation-link copy/fallback state, owner toasts, and `productKeys.all` invalidation.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not change owner API contracts.
- Do not change `PropertyOwnerCard` visuals/copy.
- Do not change `LinkPropertyOwnerDialog` validation/copy.
- Preserve invitation copy/fallback behavior and toast text exactly.
- Preserve `productKeys.all` invalidation.
- Do not extract agent, movement, document, image, status, or router behavior.
- Use pnpm, not Bun.

## Task 1: Add owner section component with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-owner-section.test.tsx` with focused tests:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropertyLinkedOwner } from '../api/types';
import { PropertyOwnerSection } from './property-owner-section';

const invitedOwner: PropertyLinkedOwner = {
  accessStatus: 'INVITED',
  email: 'owner@example.com',
  firstName: null,
  id: 'owner-link-1',
  isPrimary: true,
  lastName: null,
  ownerFirstName: 'Ana',
  ownerLastName: 'Owner',
  userId: null
};

const invitationUrl = 'http://localhost:3000/owner-invitations/raw-token-1';

describe('PropertyOwnerSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the owner link dialog from the owner card', async () => {
    const user = userEvent.setup();
    renderPropertyOwnerSection();

    await user.click(screen.getByRole('button', { name: /vincular propietario/i }));

    expect(screen.getByRole('dialog', { name: /vincular propietario/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('submits a linked owner through the BFF and closes the dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'owner-link-2' }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyOwnerSection();

    await user.click(screen.getByRole('button', { name: /vincular propietario/i }));
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Apellido'), 'Owner');
    await user.type(screen.getByLabelText('Email'), 'ANA@EXAMPLE.COM');
    await user.click(screen.getByRole('button', { name: /^vincular propietario$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/owners',
        expect.objectContaining({
          body: JSON.stringify({
            email: 'ana@example.com',
            firstName: 'Ana',
            lastName: 'Owner'
          }),
          method: 'POST'
        })
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /vincular propietario/i })).not.toBeInTheDocument();
    });
  });

  it('copies an invitation link for invited owners', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fetchMock = mockInvitationLinkResponse();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /copiar invitación/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/owners/owner-link-1/invitation-link',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(writeText).toHaveBeenCalledWith(invitationUrl);
  });

  it('shows the manual invitation fallback when clipboard copy fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    vi.stubGlobal('fetch', mockInvitationLinkResponse());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /copiar invitación/i }));

    expect(await screen.findByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: invitationUrl })).toHaveAttribute(
      'href',
      invitationUrl
    );
  });

  it('does not allow owner actions while archived', () => {
    renderPropertyOwnerSection({ isArchived: true, owners: [invitedOwner] });

    expect(screen.queryByRole('button', { name: /vincular propietario/i })).not.toBeInTheDocument();
    expect(screen.getByText('Restaurá la propiedad para vincular propietarios.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar invitación/i })).toBeDisabled();
  });
});

function renderPropertyOwnerSection({
  isArchived = false,
  ownerEmail = null,
  ownerName = null,
  owners = []
}: {
  isArchived?: boolean;
  ownerEmail?: string | null;
  ownerName?: string | null;
  owners?: PropertyLinkedOwner[];
} = {}) {
  return render(
    <PropertyOwnerSection
      isArchived={isArchived}
      ownerEmail={ownerEmail}
      ownerName={ownerName}
      owners={owners}
      productId='product-1'
    />,
    { wrapper: createQueryClientWrapper() }
  );
}

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function mockInvitationLinkResponse() {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        email: invitedOwner.email,
        expiresAt: '2026-06-12T10:00:00.000Z',
        invitationId: 'invitation-1',
        invitationUrl,
        propertyAssetOwnerId: invitedOwner.id
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 201
      }
    )
  );
}
```

Important notes:

- The archived copy action assertion depends on `PropertyOwnerCard` disabling invited copy actions when `copyingInvitationOwnerId === owner.id` or `isArchived`. If current `PropertyOwnerCard` does not disable copy when archived, do **not** silently change visual behavior without confirming. Instead, verify current behavior from `product-form.tsx`: the parent handler blocks archived copies, but the button may still be clickable. Preserve behavior unless you can make a strict non-behavior-change case.
- If the dialog remains mounted but hidden in the DOM, adjust the “closes dialog” assertion to check that the dialog content is not visible or that submit success behavior completed. Do not alter runtime behavior for a test convenience.
- If toast calls cause test warnings, mock `sonner` in the test file.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-section.test.tsx
```

Expected: FAIL because `property-owner-section.tsx` does not exist.

**Step 3: Create `property-owner-section.tsx`**

Create the component with `'use client';` because it owns hooks, clipboard access, and mutations.

Imports:

```tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { createProductOwnerInvitationLink, linkProductOwner } from '../api/service';
import type { LinkProductOwnerPayload, PropertyLinkedOwner } from '../api/types';
import { productKeys } from '../api/queries';
import { LinkPropertyOwnerDialog } from './link-property-owner-dialog';
import { PropertyOwnerCard } from './property-owner-card';
```

Props:

```tsx
type ManualInvitationFallback = {
  ownerId: string;
  invitationUrl: string;
};

type PropertyOwnerSectionProps = {
  isArchived: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  owners: PropertyLinkedOwner[];
  productId: string;
};
```

Implementation:

```tsx
export function PropertyOwnerSection({
  isArchived,
  ownerEmail,
  ownerName,
  owners,
  productId
}: PropertyOwnerSectionProps) {
  const queryClient = useQueryClient();
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [copyingInvitationOwnerId, setCopyingInvitationOwnerId] = useState<string | null>(null);
  const [manualInvitationFallback, setManualInvitationFallback] = useState<ManualInvitationFallback | null>(
    null
  );
  const linkOwnerMutation = useMutation({
    mutationFn: (payload: LinkProductOwnerPayload) => linkProductOwner(productId, payload),
    onSuccess: async () => {
      setOwnerDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Propietario vinculado');
    },
    onError: (error) => {
      toast.error(getOwnerLinkErrorMessage(error));
    }
  });

  function handleOpenOwnerDialog() {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    setOwnerDialogOpen(true);
  }

  function handleLinkOwner(payload: LinkProductOwnerPayload) {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    linkOwnerMutation.mutate(payload);
  }

  async function handleCopyInvitationLink(owner: PropertyLinkedOwner) {
    if (isArchived || copyingInvitationOwnerId) {
      return;
    }

    setCopyingInvitationOwnerId(owner.id);
    setManualInvitationFallback(null);

    try {
      const response = await createProductOwnerInvitationLink(productId, owner.id);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Link de invitación copiado. Los links anteriores ya no funcionan.');
      } catch {
        setManualInvitationFallback({ ownerId: owner.id, invitationUrl: response.invitationUrl });
        toast.warning('No pudimos copiar automáticamente. Copiá el link manualmente.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo generar el link de invitación.'
      );
    } finally {
      setCopyingInvitationOwnerId(null);
    }
  }

  return (
    <>
      <PropertyOwnerCard
        copyingInvitationOwnerId={copyingInvitationOwnerId}
        isArchived={isArchived}
        isLinkDisabled={linkOwnerMutation.isPending}
        manualInvitationFallback={manualInvitationFallback}
        ownerEmail={ownerEmail}
        ownerName={ownerName}
        owners={owners}
        onCopyInvitationLink={handleCopyInvitationLink}
        onLinkOwner={handleOpenOwnerDialog}
      />
      <LinkPropertyOwnerDialog
        open={ownerDialogOpen}
        isSubmitting={linkOwnerMutation.isPending}
        onOpenChange={setOwnerDialogOpen}
        onSubmit={handleLinkOwner}
      />
    </>
  );
}
```

Move `getOwnerLinkErrorMessage` from `product-form.tsx` unchanged:

```tsx
function getOwnerLinkErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'No se pudo vincular el propietario';
  }

  if (error.message.toLowerCase().includes('already linked')) {
    return 'Ese propietario ya está vinculado a esta propiedad';
  }

  return error.message;
}
```

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-section.test.tsx
```

Expected: PASS after any necessary test-only adjustment for current archived copy visual behavior.

## Task 2: Replace owner wiring in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx`

**Step 1: Import extracted section**

Add to `product-form.tsx` imports:

```ts
import { PropertyOwnerSection } from './property-owner-section';
```

**Step 2: Replace owner card JSX**

Replace current `PropertyOwnerCard` usage in the right aside with:

```tsx
<PropertyOwnerSection
  isArchived={isArchived}
  ownerEmail={propertyEngagement.property.ownerEmail}
  ownerName={propertyEngagement.property.ownerName}
  owners={propertyEngagement.property.owners}
  productId={propertyEngagement.id}
/>
```

**Step 3: Remove owner dialog JSX**

Remove the bottom-level `LinkPropertyOwnerDialog` usage from `PropertyEngagementDetails` because `PropertyOwnerSection` now renders it.

**Step 4: Remove owner state, mutation, handlers, helper**

Remove from `PropertyEngagementDetails`:

- `ownerDialogOpen`
- `copyingInvitationOwnerId`
- `manualInvitationFallback`
- `linkOwnerMutation`
- `handleOpenOwnerDialog`
- `handleLinkOwner`
- `handleCopyInvitationLink`

Remove local helper from `product-form.tsx`:

- `getOwnerLinkErrorMessage`

**Step 5: Remove no-longer-used imports from `product-form.tsx`**

Remove if unused after extraction:

- `createProductOwnerInvitationLink`
- `linkProductOwner`
- `LinkProductOwnerPayload`
- `PropertyLinkedOwner`
- `LinkPropertyOwnerDialog`
- `PropertyOwnerCard`

Keep `productKeys` if still used by movement/agent/restore/status/image logic.

**Step 6: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx src/features/products/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx src/features/products/components/property-detail-summary.test.tsx
```

Expected: PASS.

**Step 7: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-owner-section.tsx src/features/products/components/property-owner-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-owner-section.tsx src/features/products/components/property-owner-section.test.tsx
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 8: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx viewpro-app/apps/app-new/src/features/products/components/property-owner-section.test.tsx
git commit -m "refactor(products): extract property owner section"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract property owner section"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-section.test.tsx src/features/products/components/property-owner-card.test.tsx src/features/products/api/service.test.ts src/features/products/components/property-status-summary.test.tsx src/features/products/components/property-detail-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx
viewpro-app/apps/app-new/src/features/products/components/property-owner-section.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no owner behavior changes;
- owner link mutation/toast/invalidation is preserved;
- invitation-link copy/clipboard/manual fallback behavior is preserved;
- archived guards match prior behavior;
- `PropertyOwnerCard` and `LinkPropertyOwnerDialog` visuals/copy/validation are unchanged;
- non-owner behavior stayed in `product-form.tsx`;
- tests cover the sensitive owner flows.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product owner section
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following the image/detail/status summary extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-owner-section
gh pr create --base develop --head refactor/product-owner-section --title "refactor(products): extract product owner section" --body-file /tmp/viewpro-product-owner-section-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected code diff is larger and more behavior-sensitive than the prior presentational slices. If extraction grows into owner feature changes, unlink/revoke, invitation behavior redesign, or agent section work, stop and split.

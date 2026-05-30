# ProductForm Image Dialogs Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract image delete and preview dialogs from `product-form.tsx` into `property-image-dialogs.tsx` without changing behavior.

**Architecture:** `product-form.tsx` keeps image selected state, delete mutation, upload behavior, and form orchestration. `property-image-dialogs.tsx` exports the existing controlled delete dialog and preview/set-primary dialog. The preview dialog continues to own the set-primary mutation and `productKeys.all` invalidation exactly as before.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not move upload behavior.
- Do not move delete mutation into the dialog.
- Do not change set-primary mutation semantics.
- Preserve Spanish copy and Tailwind classes.
- Preserve toast text and `productKeys.all` invalidation.
- Use pnpm, not Bun.

## Task 1: Add image dialog module with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-image-dialogs.test.tsx` with focused tests:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropertyImage } from '../api/types';
import { DeletePropertyImageDialog, PropertyImagePreviewDialog } from './property-image-dialogs';

const setProductImageAsPrimaryMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../api/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/service')>();

  return {
    ...actual,
    setProductImageAsPrimary: (...args: Parameters<typeof actual.setProductImageAsPrimary>) =>
      setProductImageAsPrimaryMock(...args)
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock
  }
}));

const image = createImage({ id: 'image-1', originalFilename: 'fachada.jpg', isPrimary: false });

describe('DeletePropertyImageDialog', () => {
  it('renders the filename and confirms deletion', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeletePropertyImageDialog
        image={image}
        loading={false}
        open={true}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/fachada\.jpg/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /eliminar imagen/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables cancel while loading', () => {
    render(
      <DeletePropertyImageDialog
        image={image}
        loading={true}
        open={true}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});

describe('PropertyImagePreviewDialog', () => {
  afterEach(() => {
    setProductImageAsPrimaryMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('renders the selected image and primary action', () => {
    renderPropertyImagePreviewDialog({ image });

    expect(screen.getByRole('dialog', { name: /vista previa de imagen/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'fachada.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /poner como principal/i })).toBeInTheDocument();
  });

  it('disables primary action when the image is already primary', () => {
    renderPropertyImagePreviewDialog({ image: createImage({ isPrimary: true }) });

    expect(screen.getByRole('button', { name: /imagen principal/i })).toBeDisabled();
  });

  it('sets a non-primary image as primary', async () => {
    const user = userEvent.setup();
    const updatedImage = createImage({ id: image.id, isPrimary: true });
    const onPrimaryChange = vi.fn();
    setProductImageAsPrimaryMock.mockResolvedValue(updatedImage);
    renderPropertyImagePreviewDialog({ image, onPrimaryChange });

    await user.click(screen.getByRole('button', { name: /poner como principal/i }));

    await waitFor(() => {
      expect(setProductImageAsPrimaryMock).toHaveBeenCalledWith('product-1', image.id);
    });
    expect(onPrimaryChange).toHaveBeenCalledWith(updatedImage);
    expect(toastSuccessMock).toHaveBeenCalledWith('Imagen principal actualizada');
  });

  it('shows an error toast when primary update fails', async () => {
    const user = userEvent.setup();
    setProductImageAsPrimaryMock.mockRejectedValue(new Error('No autorizado'));
    renderPropertyImagePreviewDialog({ image });

    await user.click(screen.getByRole('button', { name: /poner como principal/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('No autorizado');
    });
  });
});

function renderPropertyImagePreviewDialog({
  engagementId = 'product-1',
  image: selectedImage = image,
  onPrimaryChange = vi.fn()
}: {
  engagementId?: string;
  image?: PropertyImage | null;
  onPrimaryChange?: (image: PropertyImage) => void;
} = {}) {
  return render(
    <PropertyImagePreviewDialog
      engagementId={engagementId}
      image={selectedImage}
      open={true}
      onPrimaryChange={onPrimaryChange}
      onOpenChange={vi.fn()}
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

function createImage(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    createdAt: '2026-05-30T10:00:00.000Z',
    id: 'image-id',
    isPrimary: false,
    mimeType: 'image/jpeg',
    originalFilename: 'image.jpg',
    sizeBytes: 1234,
    storageKey: 'property-images/image.jpg',
    updatedAt: '2026-05-30T10:00:00.000Z',
    url: 'https://assets.example/image.jpg',
    ...overrides
  };
}
```

Important notes:

- If the alert dialog renders two accessible buttons that match `/eliminar imagen/i`, use the exact button query that Testing Library reports. Do not change runtime copy for the test.
- If Radix dialog content remains mounted in a portal, use the existing test setup behavior and visible role queries.
- If `vi.mock` hoisting complains about variables, wrap mocks with `vi.hoisted`.
- Do not test class names unless necessary.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-dialogs.test.tsx
```

Expected: FAIL because `property-image-dialogs.tsx` does not exist.

**Step 3: Create `property-image-dialogs.tsx`**

Create the module with `'use client';` because the preview dialog uses hooks/mutations.

Imports:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import { setProductImageAsPrimary } from '../api/service';
import type { PropertyImage } from '../api/types';
import { PropertyImagePreview } from './property-images';
```

Move `DeletePropertyImageDialog` and `PropertyImagePreviewDialog` from `product-form.tsx` unchanged except:

- export both functions;
- keep current props;
- keep all copy/classes/mutation logic identical.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-dialogs.test.tsx
```

Expected: PASS after test-only mock/role-query adjustments if needed.

## Task 2: Replace local dialogs in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.tsx`

**Step 1: Import extracted dialogs**

Add to `product-form.tsx` imports:

```ts
import { DeletePropertyImageDialog, PropertyImagePreviewDialog } from './property-image-dialogs';
```

**Step 2: Remove local dialog function definitions**

Delete local definitions:

- `DeletePropertyImageDialog`
- `PropertyImagePreviewDialog`

Do not remove:

- image pending state;
- delete mutation;
- close guard;
- `ExistingImagesSummary` callbacks;
- upload behavior.

**Step 3: Remove now-unused imports from `product-form.tsx`**

Remove if unused after extraction:

- `AlertDialog`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`;
- `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`;
- `setProductImageAsPrimary`;
- `PropertyImagePreview` if no longer used in `product-form.tsx`.

Keep `Button` if still used elsewhere in editor/detail. Keep `productKeys` because delete/restore/movement still use it.

**Step 4: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx src/features/products/components/property-agents-section.test.tsx src/features/products/components/property-owner-section.test.tsx
```

Expected: PASS.

**Step 5: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-image-dialogs.tsx src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-image-dialogs.tsx src/features/products/components/property-image-dialogs.test.tsx
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 6: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.tsx viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.test.tsx
git commit -m "refactor(products): extract property image dialogs"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract property image dialogs"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-dialogs.test.tsx src/features/products/components/property-images.test.tsx src/features/products/components/property-agents-section.test.tsx src/features/products/components/property-owner-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.tsx
viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no image behavior changes;
- delete dialog props/copy/classes preserved;
- preview dialog set-primary mutation/toast/invalidation preserved;
- upload/delete parent mutation/selected image state stayed in `product-form.tsx`;
- tests cover extracted dialogs sufficiently;
- `PropertyImagePreview` usage remains correct.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product image dialogs
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following the previous ProductForm extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-image-dialogs
gh pr create --base develop --head refactor/product-image-dialogs --title "refactor(products): extract product image dialogs" --body-file /tmp/viewpro-product-image-dialogs-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected code diff is smaller than the agents/owner behavior sections. If extraction grows into upload behavior, image state management, delete mutation ownership, or image editor section redesign, stop and split.

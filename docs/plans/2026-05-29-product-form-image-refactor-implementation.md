# ProductForm Image Component Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract presentational image components from `product-form.tsx` into a focused module without changing behavior.

**Architecture:** Keep all state, mutations, handlers, dialogs, API calls, and query invalidation in `product-form.tsx`. Move only `PropertyImagePreview`, `PropertyImageCarousel`, and `ExistingImagesSummary` to `property-images.tsx`, then import them back into `product-form.tsx`.

**Tech Stack:** Next.js App Router, React, TypeScript, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- No API/service/query changes.
- No mutation hook extraction.
- Preserve Spanish copy and Tailwind classes.
- Keep the existing plain `<img>` behavior and `oxlint-disable-next-line next/no-img-element` comment.
- Keep preview/delete dialogs in `product-form.tsx` for this slice.

## Task 1: Add extracted image components with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-images.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-images.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-images.test.tsx` with focused tests:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyImage } from '../api/types';
import { ExistingImagesSummary, PropertyImageCarousel, PropertyImagePreview } from './property-images';

const firstImage = propertyImage({
  id: 'image-1',
  originalFilename: 'fachada.jpg',
  url: 'https://assets.example/fachada.jpg',
  isPrimary: true
});
const secondImage = propertyImage({
  id: 'image-2',
  originalFilename: 'living.jpg',
  url: 'https://assets.example/living.jpg',
  isPrimary: false
});

describe('PropertyImagePreview', () => {
  it('shows a fallback when the image cannot load', () => {
    render(<PropertyImagePreview src='broken.jpg' alt='Fachada' className='h-10 w-10' />);

    fireEvent.error(screen.getByRole('img', { name: 'Fachada' }));

    expect(screen.getByRole('img', { name: 'Fachada no disponible' })).toBeInTheDocument();
    expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
  });
});

describe('PropertyImageCarousel', () => {
  it('renders the empty state when there are no images', () => {
    render(<PropertyImageCarousel images={[]} title='Casa demo' />);

    expect(screen.getByText('Sin imágenes cargadas')).toBeInTheDocument();
  });

  it('renders the active image and changes image from thumbnails', async () => {
    const user = userEvent.setup();
    render(<PropertyImageCarousel images={[firstImage, secondImage]} title='Casa demo' />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagen 1 de 2 de Casa demo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver imagen 2' }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagen 2 de 2 de Casa demo' })).toBeInTheDocument();
  });
});

describe('ExistingImagesSummary', () => {
  it('renders the empty summary state', () => {
    render(
      <ExistingImagesSummary
        images={[]}
        onDeleteImage={vi.fn()}
        onPreviewImage={vi.fn()}
      />
    );

    expect(screen.getByText('Todavía no hay imágenes')).toBeInTheDocument();
  });

  it('calls preview and delete handlers for existing images', async () => {
    const user = userEvent.setup();
    const onPreviewImage = vi.fn();
    const onDeleteImage = vi.fn();
    render(
      <ExistingImagesSummary
        images={[firstImage]}
        onDeleteImage={onDeleteImage}
        onPreviewImage={onPreviewImage}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ver imagen fachada.jpg' }));
    expect(onPreviewImage).toHaveBeenCalledWith(firstImage);

    await user.click(screen.getByRole('button', { name: 'Eliminar imagen fachada.jpg' }));
    expect(onDeleteImage).toHaveBeenCalledWith(firstImage);
  });

  it('disables the delete action for the pending image', () => {
    render(
      <ExistingImagesSummary
        images={[firstImage]}
        pendingDeleteImageId={firstImage.id}
        onDeleteImage={vi.fn()}
        onPreviewImage={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Eliminar imagen fachada.jpg' })).toBeDisabled();
  });
});

function propertyImage(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'image-id',
    storageKey: 'property-images/image.jpg',
    url: 'https://assets.example/image.jpg',
    originalFilename: 'image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    isPrimary: false,
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides
  };
}
```

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx
```

Expected: FAIL because `property-images.tsx` does not exist.

**Step 3: Create `property-images.tsx`**

Move the existing implementations of these functions from `product-form.tsx` exactly as-is, changing only `function` to `export function`:

- `PropertyImagePreview`
- `PropertyImageCarousel`
- `ExistingImagesSummary`

Required imports:

```tsx
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { PropertyImage } from '../api/types';

const PROPERTY_IMAGE_MAX_FILES = 5;
```

Keep the `<img>` lint disable comment with `PropertyImagePreview`.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx
```

Expected: PASS.

## Task 2: Replace inline image components in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-images.tsx` only if export/import typing needs adjustment

**Step 1: Import extracted components**

Add to `product-form.tsx` imports:

```ts
import {
  ExistingImagesSummary,
  PropertyImageCarousel,
  PropertyImagePreview
} from './property-images';
```

**Step 2: Remove inline component definitions**

Delete the local definitions of:

- `PropertyImagePreview`
- `PropertyImageCarousel`
- `ExistingImagesSummary`

Do not delete:

- `DeletePropertyImageDialog`
- `PropertyImagePreviewDialog`

Those still use `PropertyImagePreview`, now imported.

**Step 3: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx src/features/products/components/property-document-requests.test.tsx
```

Expected: PASS.

**Step 4: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-images.tsx src/features/products/components/property-images.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-images.tsx src/features/products/components/property-images.test.tsx
git diff --check
```

Expected: PASS. If full app lint still fails on unrelated pre-existing files, document it later; do not fix unrelated lint debt in this slice.

**Step 5: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-images.tsx viewpro-app/apps/app-new/src/features/products/components/property-images.test.tsx
git commit -m "refactor(products): extract property image components"
```

## Task 3: Fresh review and PR preparation

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx src/features/products/components/property-document-requests.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-images.tsx
viewpro-app/apps/app-new/src/features/products/components/property-images.test.tsx
```

Expected: no diagnostics beyond pre-existing hints unrelated to this extraction.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no behavior changes;
- only image components were extracted;
- classes/copy stayed identical;
- mutation/query logic stayed in `product-form.tsx`;
- tests cover extracted components;
- review workload is reasonable.

**Step 4: Create issue and PR**

Issue title:

```txt
refactor(products): extract product image components
```

Labels:

```txt
enhancement
status:approved
```

PR title:

```txt
refactor(products): extract product image components
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected diff should be reviewable because it is mostly code movement plus tests. If the diff grows beyond image components, stop and split.

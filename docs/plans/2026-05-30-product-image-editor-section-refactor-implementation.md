# ProductForm Image Editor Section Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the create/edit image gallery/upload section from `product-form.tsx` into `PropertyImageEditorSection` without changing behavior.

**Architecture:** `product-form.tsx` keeps form provider ownership, image state, delete mutation, upload loop, submit mutation, and dialogs. The new `property-image-editor-section.tsx` component renders the same image editor UI inside the existing `<form.AppForm>` context and obtains `FormFileUploadField` via `useFormFields<ProductFormValues>()`.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Form, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not move image delete mutation.
- Do not move upload submit behavior.
- Do not move image dialogs.
- Do not move `form.AppForm` or `form.Form`.
- Preserve Spanish copy and Tailwind classes.
- Use pnpm, not Bun.

## Task 1: Add image editor section component with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-image-editor-section.test.tsx` with focused tests. Use the real app form provider so `FormFileUploadField` runs in the same context as production.

```tsx
import { useAppForm } from '@/components/ui/tanstack-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProductFormValues } from '../schemas/product';
import type { PropertyImage } from '../api/types';
import { productSchema } from '../schemas/product';
import { PropertyImageEditorSection } from './property-image-editor-section';

const image = createImage({ id: 'image-1', originalFilename: 'fachada.jpg', isPrimary: true });

describe('PropertyImageEditorSection', () => {
  it('renders the create-mode upload field without existing image summary', () => {
    renderPropertyImageEditorSection({ isEditMode: false });

    expect(screen.getByText('Galería de imágenes')).toBeInTheDocument();
    expect(screen.getByText('0 / 5 cargadas')).toBeInTheDocument();
    expect(screen.getByText('Imágenes iniciales')).toBeInTheDocument();
    expect(screen.queryByText('Imágenes actuales')).not.toBeInTheDocument();
  });

  it('renders existing images and edit-mode upload label', () => {
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true
    });

    expect(screen.getByText('1 / 5 cargadas')).toBeInTheDocument();
    expect(screen.getByText('Imágenes actuales')).toBeInTheDocument();
    expect(screen.getByText('Sumar nuevas imágenes')).toBeInTheDocument();
  });

  it('renders the max-images message when no slots are available', () => {
    renderPropertyImageEditorSection({
      availableImageSlots: 0,
      existingImageCount: 5,
      images: [image],
      isEditMode: true
    });

    expect(
      screen.getByText('La galería ya tiene el máximo de 5 imágenes. Eliminá una foto existente si necesitás subir otra.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Sumar nuevas imágenes')).not.toBeInTheDocument();
  });

  it('forwards preview and delete callbacks through the existing image summary', async () => {
    const user = userEvent.setup();
    const onDeleteImage = vi.fn();
    const onPreviewImage = vi.fn();
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true,
      onDeleteImage,
      onPreviewImage
    });

    await user.click(screen.getByRole('button', { name: 'Ver imagen fachada.jpg' }));
    expect(onPreviewImage).toHaveBeenCalledWith(image);

    await user.click(screen.getByRole('button', { name: 'Eliminar imagen fachada.jpg' }));
    expect(onDeleteImage).toHaveBeenCalledWith(image);
  });

  it('passes the pending delete id to the existing image summary', () => {
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true,
      pendingDeleteImageId: image.id
    });

    expect(screen.getByRole('button', { name: 'Eliminar imagen fachada.jpg' })).toBeDisabled();
  });
});

function renderPropertyImageEditorSection({
  availableImageSlots = 5,
  existingImageCount = 0,
  images = [],
  isEditMode = false,
  onDeleteImage = vi.fn(),
  onPreviewImage = vi.fn(),
  pendingDeleteImageId
}: Partial<React.ComponentProps<typeof PropertyImageEditorSection>> = {}) {
  return render(
    <ImageEditorSectionHarness
      availableImageSlots={availableImageSlots}
      existingImageCount={existingImageCount}
      images={images}
      isEditMode={isEditMode}
      onDeleteImage={onDeleteImage}
      onPreviewImage={onPreviewImage}
      pendingDeleteImageId={pendingDeleteImageId}
    />
  );
}

function ImageEditorSectionHarness(props: React.ComponentProps<typeof PropertyImageEditorSection>) {
  const form = useAppForm({
    defaultValues: createFormValues(),
    validators: { onSubmit: productSchema },
    onSubmit: vi.fn()
  });

  return (
    <form.AppForm>
      <PropertyImageEditorSection {...props} />
    </form.AppForm>
  );
}

function createFormValues(): ProductFormValues {
  return {
    addressLine: 'Av. Siempre Viva 742',
    city: 'Springfield',
    currency: 'ARS',
    image: [],
    operationType: 'SALE',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'HOUSE',
    province: 'Buenos Aires',
    title: 'Casa demo'
  } as ProductFormValues;
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

- If TypeScript complains about `React.ComponentProps`, import `type { ComponentProps } from 'react'` and use that instead.
- If exact long text matching is brittle, use a regex. Do not change production copy for test convenience.
- If FileUploader adds extra text, assert on existing stable labels/copy.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-editor-section.test.tsx
```

Expected: FAIL because `property-image-editor-section.tsx` does not exist.

**Step 3: Create `property-image-editor-section.tsx`**

Create the component module with these imports:

```tsx
'use client';

import { useFormFields } from '@/components/ui/tanstack-form';
import { Badge } from '@/components/ui/badge';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_FILES,
  type ProductFormValues
} from '@/features/products/schemas/product';
import type { PropertyImage } from '../api/types';
import { ExistingImagesSummary } from './property-images';
import { getImageUploadDescription } from './product-form-mappers';
```

Define the local accept constant in this module:

```tsx
const PROPERTY_IMAGE_ACCEPT = {
  'image/jpeg': [],
  'image/png': [],
  'image/webp': []
};
```

Props:

```tsx
type PropertyImageEditorSectionProps = {
  availableImageSlots: number;
  existingImageCount: number;
  images: PropertyImage[];
  isEditMode: boolean;
  onDeleteImage: (image: PropertyImage) => void;
  onPreviewImage: (image: PropertyImage) => void;
  pendingDeleteImageId?: string;
};
```

Implementation: move the existing section markup from `product-form.tsx` unchanged, replacing parent variables with props and using local `FormFileUploadField`:

```tsx
export function PropertyImageEditorSection({
  availableImageSlots,
  existingImageCount,
  images,
  isEditMode,
  onDeleteImage,
  onPreviewImage,
  pendingDeleteImageId
}: PropertyImageEditorSectionProps) {
  const { FormFileUploadField } = useFormFields<ProductFormValues>();

  return (
    <section className='space-y-4 rounded-2xl border bg-muted/10 p-4 md:col-span-2'>
      {/* paste existing markup */}
    </section>
  );
}
```

Behavior details to preserve:

- Progress width formula:
  ```tsx
  width: `${Math.min((existingImageCount / PROPERTY_IMAGE_MAX_FILES) * 100, 100)}%`
  ```
- Existing summary only when `isEditMode`:
  ```tsx
  {isEditMode ? <ExistingImagesSummary ... /> : null}
  ```
- Upload field props:
  ```tsx
  name='image'
  label={isEditMode ? 'Sumar nuevas imágenes' : 'Imágenes iniciales'}
  description={getImageUploadDescription(availableImageSlots)}
  maxFiles={availableImageSlots}
  maxSize={PROPERTY_IMAGE_MAX_BYTES}
  accept={PROPERTY_IMAGE_ACCEPT}
  ```

Export `PropertyImageEditorSection`.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-editor-section.test.tsx
```

Expected: PASS after type-only fixes.

## Task 2: Replace image editor section in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.tsx`

**Step 1: Import extracted component**

Add to `product-form.tsx`:

```ts
import { PropertyImageEditorSection } from './property-image-editor-section';
```

**Step 2: Replace the inline section**

Replace the entire inline image editor `<section className='space-y-4 rounded-2xl border bg-muted/10 p-4 md:col-span-2'>...</section>` with:

```tsx
<PropertyImageEditorSection
  availableImageSlots={availableImageSlots}
  existingImageCount={existingImageCount}
  images={initialData?.property.images ?? []}
  isEditMode={isEditMode}
  pendingDeleteImageId={
    deleteImageMutation.isPending ? deleteImageMutation.variables?.id : undefined
  }
  onDeleteImage={handleDeleteImage}
  onPreviewImage={setImagePreview}
/>
```

This intentionally passes images even in create mode, while the component only renders the summary when `isEditMode` is true.

**Step 3: Remove no-longer-used local code/imports**

Remove from `product-form.tsx` if unused:

- `Badge` import;
- `PROPERTY_IMAGE_MAX_BYTES` import;
- `PROPERTY_IMAGE_ACCEPT` constant;
- `ExistingImagesSummary` import;
- `getImageUploadDescription` import from `product-form-mappers`.

Keep:

- `PROPERTY_IMAGE_MAX_FILES` because editor slot calculations still use it.
- `FormFileUploadField` destructuring should be removed from `useFormFields` if no longer used in `product-form.tsx`.

Current destructure:

```ts
const { FormTextField, FormSelectField, FormFileUploadField } =
  useFormFields<ProductFormValues>();
```

should become:

```ts
const { FormTextField, FormSelectField } = useFormFields<ProductFormValues>();
```

**Step 4: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-editor-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/product-form-mappers.test.ts src/features/products/components/property-images.test.tsx src/features/products/components/property-image-dialogs.test.tsx
```

Expected: PASS.

**Step 5: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-image-editor-section.tsx src/features/products/components/property-image-editor-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-image-editor-section.tsx src/features/products/components/property-image-editor-section.test.tsx
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 6: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.tsx viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.test.tsx
git commit -m "refactor(products): extract property image editor section"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract property image editor section"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-editor-section.test.tsx src/features/products/components/product-form-mappers.test.ts src/features/products/components/property-images.test.tsx src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.tsx
viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no image editor behavior changes;
- copy/classes/progress formula/upload props are preserved;
- existing summary callbacks and pending delete id are preserved;
- form provider ownership and runtime image mutations remain in `product-form.tsx`;
- tests cover the extracted visual section sufficiently.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product image editor section
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following previous ProductForm extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-image-editor-section
gh pr create --base develop --head refactor/product-image-editor-section --title "refactor(products): extract product image editor section" --body-file /tmp/viewpro-product-image-editor-section-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected diff may exceed 400 lines because of docs + tests. If so, ask for explicit size-exception approval before opening the PR. If implementation grows into image delete mutation, upload loop, or form provider changes, stop and split.

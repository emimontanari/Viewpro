# ProductForm Editor Field Sections Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract low-risk create/edit ProductForm visual field groups into focused section components without changing behavior.

**Architecture:** `product-form.tsx` keeps the editor shell, form provider, inline `publishedPrice` custom field, currency field, submit/cancel actions, create/edit mutation, image state, image delete mutation, upload loop, and dialogs. The new `property-editor-field-sections.tsx` module renders visual field groups under the existing `<form.AppForm>` context via `useFormFields<ProductFormValues>()`.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Form, Zod, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not move `publishedPrice` in this slice.
- Do not move `form.AppForm` or `form.Form` ownership.
- Do not move submit/cancel actions.
- Do not move create/edit mutation, upload loop, image delete mutation, image state, or dialogs.
- Preserve field names, labels, placeholders, descriptions, required flags, validators, options, and layout classes.
- Use pnpm, not Bun.

## Task 1: Add editor field section tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.test.tsx`
- Create later: `viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.tsx`

**Step 1: Write failing tests**

Create `property-editor-field-sections.test.tsx` using the real app form provider.

Recommended shape:

```tsx
import { useAppForm } from '@/components/ui/tanstack-form';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { productSchema, type ProductFormValues } from '../schemas/product';
import {
  PropertyBasicFields,
  PropertyCharacteristicsFields,
  PropertyOwnerReferenceFields
} from './property-editor-field-sections';

describe('PropertyBasicFields', () => {
  it('renders the commercial and address fields with existing copy', () => {
    renderWithForm(<PropertyBasicFields />);

    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Departamento en Palermo')).toBeInTheDocument();
    expect(screen.getByText('Tipo de propiedad')).toBeInTheDocument();
    expect(screen.getByText('Dirección')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Av. Santa Fe 1234')).toBeInTheDocument();
    expect(screen.getByText('Ciudad')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CABA')).toBeInTheDocument();
    expect(screen.getByText('Provincia')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('Operación')).toBeInTheDocument();
  });
});

describe('PropertyCharacteristicsFields', () => {
  it('renders the characteristics section and physical-property fields', () => {
    renderWithForm(<PropertyCharacteristicsFields />);

    const section = screen.getByText('Características').closest('div')?.parentElement;
    expect(section).toBeInTheDocument();
    expect(
      screen.getByText('Datos físicos opcionales de la propiedad. Podés completarlos ahora o más adelante.')
    ).toBeInTheDocument();

    expect(screen.getByText('Superficie total')).toBeInTheDocument();
    expect(screen.getByText('m² totales')).toBeInTheDocument();
    expect(screen.getByText('Superficie cubierta')).toBeInTheDocument();
    expect(screen.getByText('m² cubiertos')).toBeInTheDocument();
    expect(screen.getByText('Ambientes')).toBeInTheDocument();
    expect(screen.getByText('Dormitorios')).toBeInTheDocument();
    expect(screen.getByText('Baños')).toBeInTheDocument();
    expect(screen.getByText('Cocheras')).toBeInTheDocument();
    expect(screen.getByText('Antigüedad')).toBeInTheDocument();
    expect(screen.getByText('Años')).toBeInTheDocument();
    expect(screen.getByText('Orientación')).toBeInTheDocument();
  });
});

describe('PropertyOwnerReferenceFields', () => {
  it('renders owner reference fields', () => {
    renderWithForm(<PropertyOwnerReferenceFields />);

    expect(screen.getByText('Propietario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del propietario')).toBeInTheDocument();
    expect(screen.getByText('Email del propietario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('propietario@email.com')).toBeInTheDocument();
  });
});

function renderWithForm(children: ReactNode) {
  return render(<FormHarness>{children}</FormHarness>);
}

function FormHarness({ children }: { children: ReactNode }) {
  const form = useAppForm({
    defaultValues: createFormValues(),
    validators: { onSubmit: productSchema },
    onSubmit: vi.fn()
  });

  return <form.AppForm>{children}</form.AppForm>;
}

function createFormValues(): ProductFormValues {
  return {
    addressLine: '',
    city: '',
    currency: 'ARS',
    image: [],
    operationType: 'SALE',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'APARTMENT',
    province: '',
    title: ''
  } as ProductFormValues;
}
```

Notes:

- Remove `within` if unused.
- If select placeholders are brittle, assert labels and stable field placeholders only.
- Keep tests focused on render/copy; do not add behavior not present before.

**Step 2: Verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-editor-field-sections.test.tsx
```

Expected: FAIL because `property-editor-field-sections.tsx` does not exist.

## Task 2: Create `property-editor-field-sections.tsx`

**File:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.tsx`

**Step 1: Add imports**

```tsx
'use client';

import { useFormFields } from '@/components/ui/tanstack-form';
import { type ProductFormValues } from '@/features/products/schemas/product';
import {
  operationTypeOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';
import * as z from 'zod';
```

**Step 2: Export `PropertyBasicFields`**

Move this exact sequence from `product-form.tsx`:

- `title`
- `propertyType`
- `addressLine`
- `city`
- `province`
- `operationType`

The component should call:

```tsx
const { FormTextField, FormSelectField } = useFormFields<ProductFormValues>();
```

Return a fragment containing the fields in the same order. Preserve:

- `required` flags;
- placeholders;
- current `z.string().min(...)` validators and messages;
- current select options and placeholders.

**Step 3: Export `PropertyCharacteristicsFields`**

Move the full characteristics wrapper unchanged:

```tsx
<div className='md:col-span-2 rounded-xl border bg-muted/20 p-4'>...</div>
```

The component should call:

```tsx
const { FormTextField } = useFormFields<ProductFormValues>();
```

Preserve all field props and the orientation max-length validator.

**Step 4: Export `PropertyOwnerReferenceFields`**

Move owner fields unchanged:

- `ownerName`
- `ownerEmail`

The component should call:

```tsx
const { FormTextField } = useFormFields<ProductFormValues>();
```

Return a fragment with the two fields.

**Step 5: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-editor-field-sections.test.tsx
```

Expected: PASS after type/import fixes.

## Task 3: Replace inline fields in ProductForm

**File:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Import extracted sections**

```tsx
import {
  PropertyBasicFields,
  PropertyCharacteristicsFields,
  PropertyOwnerReferenceFields
} from './property-editor-field-sections';
```

**Step 2: Replace inline basic fields**

Replace the first six fields in the editor grid with:

```tsx
<PropertyBasicFields />
```

**Step 3: Keep `publishedPrice` inline**

Do not modify the `form.AppField name='publishedPrice'` block except for imports/no-longer-used names.

**Step 4: Keep currency inline**

Leave the currency field after published price:

```tsx
<FormSelectField
  name='currency'
  label='Moneda'
  options={currencyOptions}
  placeholder='Seleccioná una moneda'
/>
```

`product-form.tsx` should still call:

```tsx
const { FormSelectField } = useFormFields<ProductFormValues>();
```

**Step 5: Replace characteristics and owner fields**

Replace the characteristics wrapper with:

```tsx
<PropertyCharacteristicsFields />
```

Replace owner fields with:

```tsx
<PropertyOwnerReferenceFields />
```

**Step 6: Remove unused imports**

From `product-form.tsx`, remove if unused:

- `* as z from 'zod'`;
- `operationTypeOptions`;
- `propertyTypeOptions`;
- `FormTextField` destructuring.

Keep:

- `currencyOptions`;
- `useFormFields` because the inline currency field still needs `FormSelectField`.

**Step 7: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-editor-field-sections.test.tsx src/features/products/components/property-image-editor-section.test.tsx src/features/products/components/product-form-mappers.test.ts
```

Expected: PASS.

## Task 4: Validate and commit implementation

**Step 1: Run full targeted validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-editor-field-sections.test.tsx src/features/products/components/property-image-editor-section.test.tsx src/features/products/components/product-form-mappers.test.ts src/features/products/components/property-images.test.tsx src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-editor-field-sections.tsx src/features/products/components/property-editor-field-sections.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-editor-field-sections.tsx src/features/products/components/property-editor-field-sections.test.tsx
git diff --check
```

Expected: PASS.

**Step 2: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.tsx viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.test.tsx
git commit -m "refactor(products): extract property editor field sections"
```

If Guardian blocks only on known pre-existing ProductForm monolith/product-property/utility-colocation warnings after validation and fresh review, parent may approve:

```bash
git commit --no-verify -m "refactor(products): extract property editor field sections"
```

## Task 5: Fresh review and final validation

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-editor-field-sections.test.tsx src/features/products/components/property-image-editor-section.test.tsx src/features/products/components/product-form-mappers.test.ts src/features/products/components/property-images.test.tsx src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.tsx
viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.test.tsx
```

Expected: no diagnostics.

**Step 3: Fresh review**

Reviewer should confirm:

- no behavior changes;
- field names/copy/placeholders/descriptions/validators/options/classes preserved;
- `publishedPrice`, `currency`, form provider, submit/upload/image runtime behavior remain in `product-form.tsx`;
- tests cover extracted sections enough for a no-behavior visual refactor.

## Task 6: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product editor field sections
```

Labels:

```txt
enhancement
status:approved
```

Issue body should state this is a no-behavior-change ProductForm refactor following the image editor section extraction.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-editor-field-sections
gh pr create --base develop --head refactor/product-editor-field-sections --title "refactor(products): extract product editor field sections" --body-file /tmp/viewpro-product-editor-field-sections-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

This PR may exceed 400 changed lines because it includes design docs, implementation plan, implementation, and tests. Ask for explicit user size-exception approval before opening the PR if the final diff is above 400 lines.

If extraction expands into `publishedPrice`, submit/upload behavior, image runtime logic, or form provider ownership, stop and split.

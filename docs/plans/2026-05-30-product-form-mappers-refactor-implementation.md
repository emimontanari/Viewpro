# ProductForm Mapper Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract pure ProductForm default-value, payload, amount, and copy helpers into `product-form-mappers.ts` without changing behavior.

**Architecture:** `product-form.tsx` keeps runtime behavior and JSX. `product-form-mappers.ts` exports pure helpers used by the editor and covered by unit tests. Runtime mutations, image upload/delete, and TanStack Form wiring stay in `product-form.tsx`.

**Tech Stack:** TypeScript, Vitest, existing product API/types/schema modules.

---

## Non-negotiables

- No behavior changes.
- Do not move form JSX.
- Do not move `uploadSelectedImages`.
- Do not move `getCarouselImages`.
- Do not change API/service behavior.
- Preserve current payload shapes, null/undefined behavior, amount parsing/formatting, and copy.
- Use pnpm, not Bun.

## Task 1: Add mapper tests and module

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.ts`
- Create: `viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.test.ts`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing unit tests**

Create `product-form-mappers.test.ts` with focused tests:

```ts
import { describe, expect, it } from 'vitest';
import type { Product } from '../api/types';
import type { ProductFormValues } from '../schemas/product';
import {
  formatAmountInput,
  getDefaultValues,
  getImageUploadDescription,
  getPropertySaveSuccessMessage,
  parseAmountInput,
  toCreatePayload,
  toUpdatePayload
} from './product-form-mappers';

describe('product-form-mappers', () => {
  it('builds empty create defaults', () => {
    expect(getDefaultValues(null)).toEqual({
      addressLine: '',
      ageYears: undefined,
      bathrooms: undefined,
      bedrooms: undefined,
      city: '',
      coveredAreaSqm: undefined,
      currency: 'ARS',
      garages: undefined,
      image: [],
      operationType: 'SALE',
      orientation: '',
      ownerEmail: '',
      ownerName: '',
      propertyType: 'APARTMENT',
      province: '',
      publishedPrice: undefined,
      rooms: undefined,
      title: '',
      totalAreaSqm: undefined
    });
  });

  it('maps an existing product into edit defaults', () => {
    expect(getDefaultValues(createProduct())).toMatchObject({
      addressLine: 'Av. Siempre Viva 742',
      ageYears: 15,
      bathrooms: 2,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: 95,
      currency: 'USD',
      garages: 1,
      image: [],
      operationType: 'SALE',
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPrice: 120000,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('builds create payloads with only filled optional values', () => {
    expect(
      toCreatePayload(
        createFormValues({
          ageYears: '',
          bathrooms: 2,
          bedrooms: undefined,
          coveredAreaSqm: 95,
          currency: 'usd',
          garages: 0,
          orientation: ' Norte ',
          ownerEmail: 'owner@example.com',
          ownerName: 'Ana Owner',
          publishedPrice: 120000,
          rooms: 4,
          totalAreaSqm: 120
        })
      )
    ).toEqual({
      addressLine: 'Av. Siempre Viva 742',
      bathrooms: 2,
      city: 'Springfield',
      coveredAreaSqm: 95,
      currency: 'USD',
      garages: 0,
      operationType: 'SALE',
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPriceCents: 12000000,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('builds update payloads with nulls for cleared optional values', () => {
    expect(
      toUpdatePayload(
        createFormValues({
          ageYears: '',
          bathrooms: undefined,
          bedrooms: 3,
          coveredAreaSqm: '',
          currency: 'ars',
          garages: 0,
          orientation: '  ',
          ownerEmail: '',
          ownerName: '  Ana Owner  ',
          publishedPrice: '',
          rooms: 4,
          totalAreaSqm: 120
        })
      )
    ).toEqual({
      addressLine: 'Av. Siempre Viva 742',
      ageYears: null,
      bathrooms: null,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: null,
      currency: 'ARS',
      garages: 0,
      operationType: 'SALE',
      orientation: null,
      ownerEmail: null,
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPriceCents: null,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('formats and parses amount input like the current editor', () => {
    expect(formatAmountInput(120000)).toBe('120.000');
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput(undefined)).toBe('');
    expect(parseAmountInput('$ 120.000')).toBe(120000);
    expect(parseAmountInput('abc')).toBe('');
  });

  it('keeps image upload descriptions and save messages', () => {
    expect(getImageUploadDescription(1)).toBe(
      'Podés seleccionar hasta 1 imagen. JPG, PNG o WebP de hasta 5 MB cada una.'
    );
    expect(getImageUploadDescription(3)).toBe(
      'Podés seleccionar hasta 3 imágenes. JPG, PNG o WebP de hasta 5 MB cada una.'
    );
    expect(getPropertySaveSuccessMessage('create', 0)).toBe('Propiedad creada correctamente');
    expect(getPropertySaveSuccessMessage('edit', 0)).toBe('Propiedad actualizada correctamente');
    expect(getPropertySaveSuccessMessage('create', 2)).toBe(
      'Propiedad creada y 2 imágenes subidas.'
    );
  });
});

function createFormValues(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    addressLine: 'Av. Siempre Viva 742',
    ageYears: undefined,
    bathrooms: undefined,
    bedrooms: undefined,
    city: 'Springfield',
    coveredAreaSqm: undefined,
    currency: 'ARS',
    garages: undefined,
    image: [],
    operationType: 'SALE',
    orientation: '',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'HOUSE',
    province: 'Buenos Aires',
    publishedPrice: undefined,
    rooms: undefined,
    title: 'Casa demo',
    totalAreaSqm: undefined,
    ...overrides
  } as ProductFormValues;
}

function createProduct(overrides: Partial<Product> & { property?: Partial<Product['property']> } = {}): Product {
  const { property: propertyOverrides, ...productOverrides } = overrides;

  return {
    agents: [],
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    createdAt: '2026-05-30T10:00:00.000Z',
    currency: 'USD',
    id: 'product-1',
    operationType: 'SALE',
    property: {
      addressLine: 'Av. Siempre Viva 742',
      ageYears: 15,
      bathrooms: 2,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: 95,
      garages: 1,
      id: 'property-1',
      images: [],
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      owners: [],
      primaryImage: null,
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120,
      ...propertyOverrides
    },
    publishedPriceCents: 12000000,
    status: 'CAPTURE',
    tenantId: 'tenant-1',
    updatedAt: '2026-05-30T10:00:00.000Z',
    ...productOverrides
  };
}
```

Important notes:

- The create payload currently trims `orientation` but does **not** trim owner name/email. Preserve this behavior unless explicitly changing behavior later.
- If TypeScript dislikes lowercase currency overrides (`'usd'`, `'ars'`) because `ProductFormValues` narrows them, cast only in tests or use valid uppercase values and assert uppercase behavior elsewhere. Do not change runtime behavior for test convenience.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/product-form-mappers.test.ts
```

Expected: FAIL because `product-form-mappers.ts` does not exist.

**Step 3: Create `product-form-mappers.ts`**

Create module imports:

```ts
import type { Product, ProductMutationPayload } from '../api/types';
import type { ProductFormValues } from '../schemas/product';
```

Move and export these functions from `product-form.tsx`:

```ts
export function getDefaultValues(initialData: Product | null): ProductFormValues { ... }
export function toCreatePayload(value: ProductFormValues): ProductMutationPayload { ... }
export function toUpdatePayload(value: ProductFormValues): ProductMutationPayload { ... }
export function getImageUploadDescription(availableImageSlots: number) { ... }
export function getPropertySaveSuccessMessage(type: 'create' | 'edit', imageUploadCount: number) { ... }
export function formatAmountInput(value: number | '' | undefined) { ... }
export function parseAmountInput(value: string) { ... }
```

Keep these helpers internal in the new file:

```ts
function optionalIntegerValue(value: number | '' | undefined) { ... }
function optionalIntegerOrNull(value: number | '' | undefined) { ... }
function centsToAmount(value: number | null | undefined) { ... }
function amountToCents(value: number) { ... }
function optionalAmountToCentsOrNull(value: number | '' | undefined) { ... }
function optionalStringOrNull(value: string | undefined) { ... }
```

Copy implementations exactly from `product-form.tsx`.

**Step 4: Run mapper tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/product-form-mappers.test.ts
```

Expected: PASS after any type-only test fixes.

## Task 2: Replace local helpers in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.ts`

**Step 1: Import exported helpers**

Add to `product-form.tsx`:

```ts
import {
  formatAmountInput,
  getDefaultValues,
  getImageUploadDescription,
  getPropertySaveSuccessMessage,
  parseAmountInput,
  toCreatePayload,
  toUpdatePayload
} from './product-form-mappers';
```

**Step 2: Remove local helper definitions**

Remove from `product-form.tsx`:

- `getDefaultValues`
- `toCreatePayload`
- `toUpdatePayload`
- `getImageUploadDescription`
- `getPropertySaveSuccessMessage`
- `optionalIntegerValue`
- `optionalIntegerOrNull`
- `centsToAmount`
- `formatAmountInput`
- `parseAmountInput`
- `amountToCents`
- `optionalAmountToCentsOrNull`
- `optionalStringOrNull`

Keep in `product-form.tsx`:

- `uploadSelectedImages`
- `getCarouselImages`
- `preventAccidentalEnterSubmit`

**Step 3: Remove unused type imports if any**

Check if `ProductMutationPayload` is still used in `product-form.tsx`. It should become unused after extraction; remove it from the type import if so.

**Step 4: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/product-form-mappers.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/use-property-movements-controller.test.tsx src/features/products/components/property-image-dialogs.test.tsx
```

Expected: PASS.

**Step 5: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/product-form-mappers.ts src/features/products/components/product-form-mappers.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/product-form-mappers.ts src/features/products/components/product-form-mappers.test.ts
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 6: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.ts viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.test.ts
git commit -m "refactor(products): extract product form mappers"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract product form mappers"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/product-form-mappers.test.ts src/features/products/components/use-property-movements-controller.test.tsx src/features/products/components/property-image-dialogs.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.ts
viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.test.ts
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no mapper/default/payload behavior changes;
- create payload and update payload null/undefined behavior is preserved;
- amount parsing/formatting behavior is preserved;
- form JSX, upload loop, delete mutation, and detail behavior were not moved;
- tests cover the extracted pure helpers sufficiently.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product form mappers
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following previous ProductForm extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-form-mappers
gh pr create --base develop --head refactor/product-form-mappers --title "refactor(products): extract product form mappers" --body-file /tmp/viewpro-product-form-mappers-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected diff may exceed 400 lines because of docs + tests. If so, ask for explicit size-exception approval before opening the PR. If implementation grows into visual form section extraction, upload logic extraction, or behavior changes, stop and split.

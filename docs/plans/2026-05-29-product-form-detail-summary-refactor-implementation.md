# ProductForm Detail Summary Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract detail header and read-only property sections from `product-form.tsx` into a focused presentational component module without changing behavior.

**Architecture:** `product-form.tsx` remains the container for router actions, mutations, queries, dialogs, owners, agents, documents, movements, status updates, and archive aside. The new `property-detail-summary.tsx` module receives product data plus action callbacks and renders the same header/read-only UI with the same copy and classes.

**Tech Stack:** Next.js App Router, React, TypeScript, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- No API/service/query changes.
- No mutation hook extraction.
- Do not move owner, agent, movement, document request, status select, or archive aside logic.
- Preserve Spanish copy and Tailwind classes.
- Keep routing/mutation callbacks owned by `product-form.tsx`.
- Use pnpm, not Bun.

## Task 1: Add detail summary components with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-detail-summary.test.tsx` with focused tests:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../api/types';
import { PropertyDetailHeader, PropertyReadOnlySections } from './property-detail-summary';

const propertyEngagement = createProduct();

describe('PropertyDetailHeader', () => {
  it('renders the title, badges, address, facts, and actions', () => {
    renderPropertyDetailHeader();

    expect(screen.getByText('Ficha de captación')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Casa demo' })).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText(/Springfield/)).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al listado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar actualización/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar propiedad/i })).toBeInTheDocument();
  });

  it('calls header action callbacks', async () => {
    const user = userEvent.setup();
    const onBackToList = vi.fn();
    const onAddMovement = vi.fn();
    const onEdit = vi.fn();
    renderPropertyDetailHeader({ onBackToList, onAddMovement, onEdit });

    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));
    await user.click(screen.getByRole('button', { name: /agregar actualización/i }));
    await user.click(screen.getByRole('button', { name: /editar propiedad/i }));

    expect(onBackToList).toHaveBeenCalledTimes(1);
    expect(onAddMovement).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows restore action and hides movement action when archived', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    renderPropertyDetailHeader({
      isArchived: true,
      onRestore,
      propertyEngagement: createProduct({ archivedAt: '2026-05-29T12:00:00.000Z' })
    });

    expect(screen.getByText('Archivada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar actualización/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar propiedad/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restaurar propiedad/i }));

    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

describe('PropertyReadOnlySections', () => {
  it('renders main property information and characteristic values', () => {
    render(<PropertyReadOnlySections propertyEngagement={propertyEngagement} />);

    expect(screen.getByText('Información principal')).toBeInTheDocument();
    expect(screen.getByText('Características')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText('Springfield, Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('120 m²')).toBeInTheDocument();
    expect(screen.getByText('95 m²')).toBeInTheDocument();
    expect(screen.getByText('15 años')).toBeInTheDocument();
  });

  it('renders missing numeric characteristics as Sin dato', () => {
    render(
      <PropertyReadOnlySections
        propertyEngagement={createProduct({
          property: {
            totalAreaSqm: null,
            coveredAreaSqm: null,
            rooms: null,
            bedrooms: null,
            bathrooms: null,
            garages: null,
            ageYears: null,
            orientation: null
          }
        })}
      />
    );

    expect(screen.getAllByText('Sin dato')).toHaveLength(8);
  });
});

function renderPropertyDetailHeader(
  props: Partial<React.ComponentProps<typeof PropertyDetailHeader>> = {}
) {
  return render(
    <PropertyDetailHeader
      isAddingMovement={false}
      isArchived={false}
      isRestoring={false}
      pageTitle='Ficha de captación'
      propertyEngagement={propertyEngagement}
      onAddMovement={vi.fn()}
      onBackToList={vi.fn()}
      onEdit={vi.fn()}
      onRestore={vi.fn()}
      {...props}
    />
  );
}

function createProduct(overrides: Partial<Product> & { property?: Partial<Product['property']> } = {}): Product {
  return {
    id: 'engagement-1',
    tenantId: 'tenant-1',
    operationType: 'SALE',
    status: 'CAPTURE',
    publishedPriceCents: 12000000,
    currency: 'ARS',
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    property: {
      id: 'property-1',
      title: 'Casa demo',
      addressLine: 'Av. Siempre Viva 742',
      city: 'Springfield',
      province: 'Buenos Aires',
      propertyType: 'HOUSE',
      totalAreaSqm: 120,
      coveredAreaSqm: 95,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      garages: 1,
      ageYears: 15,
      orientation: 'Norte',
      ownerName: 'Ana Owner',
      ownerEmail: 'owner@example.com',
      owners: [],
      images: [],
      primaryImage: null,
      ...overrides.property
    },
    agents: [],
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
    property: {
      id: 'property-1',
      title: 'Casa demo',
      addressLine: 'Av. Siempre Viva 742',
      city: 'Springfield',
      province: 'Buenos Aires',
      propertyType: 'HOUSE',
      totalAreaSqm: 120,
      coveredAreaSqm: 95,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      garages: 1,
      ageYears: 15,
      orientation: 'Norte',
      ownerName: 'Ana Owner',
      ownerEmail: 'owner@example.com',
      owners: [],
      images: [],
      primaryImage: null,
      ...overrides.property
    }
  };
}
```

Important: if TypeScript dislikes `React.ComponentProps` without a namespace import, add:

```ts
import type { ComponentProps } from 'react';
```

and change the helper type to `Partial<ComponentProps<typeof PropertyDetailHeader>>`.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx
```

Expected: FAIL because `property-detail-summary.tsx` does not exist.

**Step 3: Create `property-detail-summary.tsx`**

Create the component module with these imports:

```tsx
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Product } from '../api/types';
import {
  getArchivedTone,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyAddress,
  getPropertyFacts,
  getPropertyTypeLabel,
  getStatusLabel,
  getStatusTone
} from './product-tables/columns';
```

Implement `PropertyDetailHeader` by moving the existing header content from `product-form.tsx` and replacing inline parent behavior with callback props:

```tsx
type PropertyDetailHeaderProps = {
  propertyEngagement: Product;
  pageTitle: string;
  isArchived: boolean;
  isRestoring: boolean;
  isAddingMovement: boolean;
  onBackToList: () => void;
  onRestore: () => void;
  onAddMovement: () => void;
  onEdit: () => void;
};

export function PropertyDetailHeader({
  propertyEngagement,
  pageTitle,
  isArchived,
  isRestoring,
  isAddingMovement,
  onBackToList,
  onRestore,
  onAddMovement,
  onEdit
}: PropertyDetailHeaderProps) {
  const address = getPropertyAddress(propertyEngagement.property);
  const propertyFacts = getPropertyFacts(propertyEngagement.property);

  return (
    <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
      {/* paste existing header inner markup here */}
    </div>
  );
}
```

When pasting:

- Replace `router.push('/dashboard/product')` with `onBackToList`.
- Replace `restoreMutation.isPending` with `isRestoring`.
- Replace `handleRestoreProperty` with `onRestore`.
- Replace `createMovementMutation.isPending` with `isAddingMovement`.
- Replace `setMovementDialogOpen(true)` with `onAddMovement`.
- Replace edit router push with `onEdit`.
- Keep copy/classes/icons exactly.
- Keep archived behavior exactly: archived shows restore copy and does not render add movement/edit buttons.

Implement `PropertyReadOnlySections` by moving the two existing read-only sections and `ReadOnlyField`:

```tsx
type PropertyReadOnlySectionsProps = {
  propertyEngagement: Product;
};

export function PropertyReadOnlySections({ propertyEngagement }: PropertyReadOnlySectionsProps) {
  return (
    <>
      {/* paste Información principal section */}
      {/* paste Características section */}
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1 rounded-xl border bg-background p-3 shadow-xs'>
      <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </div>
      <div className='break-words text-sm font-medium'>{value}</div>
    </div>
  );
}
```

Move/copy the formatting helpers needed by `PropertyReadOnlySections` into `property-detail-summary.tsx`:

```tsx
function formatOptionalNumber(value: number | null) {
  return value === null ? 'Sin dato' : `${value}`;
}

function formatNumberWithSuffix(value: number | null, suffix: string) {
  return value === null ? 'Sin dato' : `${value} ${suffix}`;
}
```

Do not move `formatPrice` because price aside remains in `product-form.tsx`.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx
```

Expected: PASS.

## Task 2: Replace inline detail header and read-only sections in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.tsx`

**Step 1: Import extracted components**

Add to `product-form.tsx` imports:

```ts
import { PropertyDetailHeader, PropertyReadOnlySections } from './property-detail-summary';
```

**Step 2: Replace header inner markup**

In `PropertyEngagementDetails`, replace the entire `<div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>...</div>` inside `CardHeader` with:

```tsx
<PropertyDetailHeader
  isAddingMovement={createMovementMutation.isPending}
  isArchived={isArchived}
  isRestoring={restoreMutation.isPending}
  pageTitle={pageTitle}
  propertyEngagement={propertyEngagement}
  onAddMovement={() => setMovementDialogOpen(true)}
  onBackToList={() => router.push('/dashboard/product')}
  onEdit={() => router.push(`/dashboard/product/${propertyEngagement.id}/edit`)}
  onRestore={handleRestoreProperty}
/>
```

**Step 3: Replace read-only sections**

Replace the two local sections for “Información principal” and “Características” with:

```tsx
<PropertyReadOnlySections propertyEngagement={propertyEngagement} />
```

**Step 4: Remove now-unused local code**

Remove local `ReadOnlyField` from `product-form.tsx`.

Check if these local variables are no longer used and remove them if unused:

```ts
const address = getPropertyAddress(propertyEngagement.property);
const propertyFacts = getPropertyFacts(propertyEngagement.property);
```

Check imports and local helpers:

- If `getOperationTone`, `getPropertyFacts`, `getPropertyAddress`, `getArchivedTone` become unused in `product-form.tsx`, remove them from the import list.
- Keep `getOperationTypeLabel`, `getPropertyTypeLabel`, `getStatusLabel`, and `getStatusTone` if still used elsewhere in this file.
- If `formatOptionalNumber` and `formatNumberWithSuffix` become unused in `product-form.tsx`, remove those helpers from this file.
- Keep `formatPrice` in `product-form.tsx`.

**Step 5: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
```

Expected: PASS.

**Step 6: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-detail-summary.tsx src/features/products/components/property-detail-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-detail-summary.tsx src/features/products/components/property-detail-summary.test.tsx
git diff --check
```

Expected: PASS. If full app lint still fails on unrelated pre-existing files, document it later; do not fix unrelated lint debt.

**Step 7: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.tsx viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.test.tsx
git commit -m "refactor(products): extract property detail summary"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.tsx
viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no behavior changes;
- only detail header/read-only sections were extracted;
- router/mutations/dialog/status/owner/agent/movement/document behavior stayed in `product-form.tsx`;
- classes/copy stayed equivalent;
- tests cover extracted components;
- review workload is reasonable.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product detail summary
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following the image extraction.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-form-detail-summary
gh pr create --base develop --head refactor/product-form-detail-summary --title "refactor(products): extract product detail summary" --body-file /tmp/viewpro-product-detail-summary-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected code diff should be a focused move plus tests. If extraction grows into owner/agents/status/archived aside behavior, stop and split.

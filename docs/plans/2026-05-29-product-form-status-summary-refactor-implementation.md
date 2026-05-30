# ProductForm Status Summary Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the ProductForm detail aside price/status/archive summary into a focused component without changing behavior.

**Architecture:** `product-form.tsx` keeps all page orchestration, owner/agent/movement/document/image behavior, router calls, and mutation handlers. The new `property-status-summary.tsx` component receives the existing `Product` and `isArchived` flag, renders the same price/status/archive UI, and imports the existing `QuickStatusSelect` without changing its behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- No API/service/query changes.
- Do not change `QuickStatusSelect`.
- Do not extract owner, agent, movement, document request, image, router, or mutation behavior.
- Preserve Spanish copy and Tailwind classes.
- Use pnpm, not Bun.

## Task 1: Add status summary component with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-status-summary.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-status-summary.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-status-summary.test.tsx` with focused tests:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../api/types';
import { PropertyStatusSummary } from './property-status-summary';

describe('PropertyStatusSummary', () => {
  it('renders the published price, currency, and status section', () => {
    renderPropertyStatusSummary();

    expect(screen.getByText('Precio publicado')).toBeInTheDocument();
    expect(screen.getByText('$ 120.000')).toBeInTheDocument();
    expect(screen.getByText('Moneda: ARS')).toBeInTheDocument();
    expect(screen.getByText('Estado comercial')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de Casa demo' })).toBeInTheDocument();
  });

  it('renders Sin precio and default ARS currency when price and currency are missing', () => {
    renderPropertyStatusSummary({
      propertyEngagement: createProduct({ currency: null, publishedPriceCents: null })
    });

    expect(screen.getByText('Sin precio')).toBeInTheDocument();
    expect(screen.getByText('Moneda: ARS')).toBeInTheDocument();
  });

  it('renders archived details when the property is archived', () => {
    renderPropertyStatusSummary({
      isArchived: true,
      propertyEngagement: createProduct({
        archivedAt: '2026-05-29T12:00:00.000Z',
        archiveReason: 'Venta pausada'
      })
    });

    expect(screen.getByText('Archivada')).toBeInTheDocument();
    expect(screen.getByText('Fecha:')).toBeInTheDocument();
    expect(screen.getByText('Motivo:')).toBeInTheDocument();
    expect(screen.getByText('Venta pausada')).toBeInTheDocument();
  });

  it('hides archived details when the property is active', () => {
    renderPropertyStatusSummary();

    expect(screen.queryByText('Motivo:')).not.toBeInTheDocument();
  });
});

function renderPropertyStatusSummary({
  isArchived = false,
  propertyEngagement = createProduct()
}: {
  isArchived?: boolean;
  propertyEngagement?: Product;
} = {}) {
  return render(
    <PropertyStatusSummary isArchived={isArchived} propertyEngagement={propertyEngagement} />,
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

type ProductOverrides = Omit<Partial<Product>, 'property'> & {
  property?: Partial<Product['property']>;
};

function createProduct(overrides: ProductOverrides = {}): Product {
  const { property: propertyOverrides, ...productOverrides } = overrides;

  return {
    agents: [],
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    createdAt: '2026-05-29T10:00:00.000Z',
    currency: 'ARS',
    id: 'engagement-1',
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
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...productOverrides
  };
}
```

If the exact formatted price differs, update the expectation to match the existing `formatPrice` output from `product-form.tsx`; do not change formatting behavior to satisfy the test.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx
```

Expected: FAIL because `property-status-summary.tsx` does not exist.

**Step 3: Create `property-status-summary.tsx`**

Create the component module with these imports:

```tsx
import { Icons } from '@/components/icons';
import type { Product } from '../api/types';
import { formatDateTime } from '../utils/formatters';
import { QuickStatusSelect } from './quick-status-select';
```

Implement the exported component:

```tsx
type PropertyStatusSummaryProps = {
  isArchived: boolean;
  propertyEngagement: Product;
};

export function PropertyStatusSummary({
  isArchived,
  propertyEngagement
}: PropertyStatusSummaryProps) {
  return (
    <>
      <div className='rounded-xl border bg-muted/20 p-5'>
        <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Precio publicado
        </div>
        <div className='mt-3 text-4xl font-bold tracking-tight'>
          {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          Moneda: {propertyEngagement.currency ?? 'ARS'}
        </p>
      </div>

      <ReadOnlyStatusField propertyEngagement={propertyEngagement} />

      {isArchived ? (
        <ArchivedStatePanel
          archivedAt={propertyEngagement.archivedAt}
          archiveReason={propertyEngagement.archiveReason}
        />
      ) : null}
    </>
  );
}
```

Move the current `ArchivedStatePanel`, `ReadOnlyStatusField`, and `formatPrice` implementations from `product-form.tsx` into this file unchanged.

Expected helper shape after move:

```tsx
function ArchivedStatePanel({
  archivedAt,
  archiveReason
}: {
  archivedAt: string | null;
  archiveReason: string | null;
}) {
  return (
    <div className='space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200'>
      <div className='flex items-center gap-2'>
        <Icons.eyeOff className='size-4' />
        <div className='text-xs font-medium uppercase tracking-wide'>Archivada</div>
      </div>
      <div className='space-y-2 text-sm'>
        <div>
          <span className='font-medium'>Fecha: </span>
          {formatDateTime(archivedAt)}
        </div>
        {archiveReason ? (
          <div>
            <span className='font-medium'>Motivo: </span>
            <span className='break-words'>{archiveReason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

```tsx
function ReadOnlyStatusField({ propertyEngagement }: { propertyEngagement: Product }) {
  return (
    <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
      <div>
        <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Estado comercial
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>
          Actualizá el avance sin entrar a edición completa.
        </p>
      </div>
      <QuickStatusSelect
        propertyEngagement={propertyEngagement}
        className='h-10 max-w-none rounded-lg px-3 text-sm'
      />
    </div>
  );
}
```

```tsx
function formatPrice(valueInCents: number | null, currency: string | null) {
  if (valueInCents === null) {
    return 'Sin precio';
  }

  return new Intl.NumberFormat('es-AR', {
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(valueInCents / 100);
}
```

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx
```

Expected: PASS.

## Task 2: Replace inline status summary in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-status-summary.tsx`

**Step 1: Import extracted component**

Add to `product-form.tsx` imports:

```ts
import { PropertyStatusSummary } from './property-status-summary';
```

**Step 2: Replace right aside price/status/archive block**

In `PropertyEngagementDetails`, replace these existing blocks inside the `<aside>`:

- price card;
- `<ReadOnlyStatusField propertyEngagement={propertyEngagement} />`;
- conditional `<ArchivedStatePanel ... />`.

with:

```tsx
<PropertyStatusSummary isArchived={isArchived} propertyEngagement={propertyEngagement} />
```

Keep `PropertyOwnerCard` and `PropertyAgentsPanel` below it unchanged.

**Step 3: Remove now-unused local code and imports**

Remove local helpers from `product-form.tsx`:

- `ArchivedStatePanel`
- `ReadOnlyStatusField`
- `formatPrice`

Remove imports only if unused after extraction:

- `QuickStatusSelect`
- `formatDateTime`

Keep `Icons` if still used elsewhere in `product-form.tsx`.

**Step 4: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
```

Expected: PASS.

**Step 5: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-status-summary.tsx src/features/products/components/property-status-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-status-summary.tsx src/features/products/components/property-status-summary.test.tsx
git diff --check
```

Expected: PASS. If pre-commit Guardian flags the pre-existing `product-form.tsx` monolith only, stop and request parent approval before `--no-verify`.

**Step 6: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-status-summary.tsx viewpro-app/apps/app-new/src/features/products/components/property-status-summary.test.tsx
git commit -m "refactor(products): extract property status summary"
```

If parent approves because Guardian only flags pre-existing monolith risk after all checks pass:

```bash
git commit --no-verify -m "refactor(products): extract property status summary"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-status-summary.tsx
viewpro-app/apps/app-new/src/features/products/components/property-status-summary.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no behavior changes;
- only price/status/archive summary was extracted;
- owner/agent/movement/document/image/router/mutation behavior stayed in `product-form.tsx`;
- `QuickStatusSelect` behavior is untouched;
- classes/copy stayed equivalent;
- tests cover extracted component;
- review workload is reasonable.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product status summary
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following the image and detail summary extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-form-status-summary
gh pr create --base develop --head refactor/product-form-status-summary --title "refactor(products): extract product status summary" --body-file /tmp/viewpro-product-status-summary-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected code diff should be a focused move plus tests. If extraction grows into owner/agents/movement/document/image behavior, stop and split.

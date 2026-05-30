# ProductForm Movements Controller Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract movement dialog/query/create-mutation orchestration from `product-form.tsx` into `usePropertyMovementsController` without changing behavior or layout.

**Architecture:** `product-form.tsx` keeps the existing header, movement history, and movement dialog JSX positions. The new controller hook owns movement dialog state, movement history query, create movement mutation, archived/pending guards, toasts, and invalidation logic.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not move the header “Agregar actualización” button.
- Do not move movement history or dialog visual placement.
- Preserve movement query key and fetch function.
- Preserve create movement invalidation behavior exactly.
- Preserve archived/pending guards.
- Preserve toast text.
- Use pnpm, not Bun.

## Task 1: Add movement controller hook with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.ts`
- Create: `viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing hook/controller tests**

Create `use-property-movements-controller.test.tsx` with focused tests. Use a harness component rather than `renderHook` to stay within current Testing Library dependencies.

```tsx
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productKeys } from '../api/queries';
import type { ProductMovementMutationPayload } from '../api/types';
import { usePropertyMovementsController } from './use-property-movements-controller';

const movement = {
  actor: null,
  createdAt: '2026-05-30T10:00:00.000Z',
  description: 'Primer contacto',
  id: 'movement-1',
  interestLevel: null,
  metadata: null,
  newStatus: null,
  occurredAt: '2026-05-30T10:00:00.000Z',
  previousStatus: null,
  propertyEngagementId: 'product-1',
  scheduledAt: null,
  source: 'MANUAL',
  tenantId: 'tenant-1',
  title: 'Llamada inicial',
  type: 'GENERAL_UPDATE',
  updatedAt: '2026-05-30T10:00:00.000Z'
};

describe('usePropertyMovementsController', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads movement history with the existing movements endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [movement], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness();

    expect(await screen.findByText('items:1')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/movements?pageSize=8&order=desc',
      expect.objectContaining({ cache: 'no-store', credentials: 'include' })
    );
  });

  it('creates a movement without status change and invalidates movements plus detail', async () => {
    const user = userEvent.setup();
    const invalidateQueries = vi.fn();
    const fetchMock = mockMovementFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness({ invalidateQueries });

    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await user.click(screen.getByRole('button', { name: 'create movement' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/movements',
        expect.objectContaining({
          body: JSON.stringify(createMovementPayload()),
          method: 'POST'
        })
      );
    });
    expect(screen.getByText('dialog:false')).toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: productKeys.movements('product-1', 'tenant-1')
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: productKeys.detail('product-1', 'tenant-1')
    });
  });

  it('creates a status-changing movement and invalidates movements plus all products', async () => {
    const user = userEvent.setup();
    const invalidateQueries = vi.fn();
    vi.stubGlobal('fetch', mockMovementFetch());
    renderControllerHarness({ invalidateQueries, payload: createMovementPayload({ newStatus: 'ACTIVE_PUBLICATION' }) });

    await user.click(screen.getByRole('button', { name: 'create movement' }));

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: productKeys.movements('product-1', 'tenant-1')
      });
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: productKeys.all });
  });

  it('does not create movements when archived', async () => {
    const user = userEvent.setup();
    const fetchMock = mockMovementFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness({ isArchived: true });

    await user.click(screen.getByRole('button', { name: 'create movement' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/movements?pageSize=8&order=desc',
      expect.anything()
    );
  });
});

function renderControllerHarness({
  invalidateQueries,
  isArchived = false,
  payload = createMovementPayload()
}: {
  invalidateQueries?: ReturnType<typeof vi.fn>;
  isArchived?: boolean;
  payload?: ProductMovementMutationPayload;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  if (invalidateQueries) {
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueries);
  }

  return render(<MovementControllerHarness isArchived={isArchived} payload={payload} />, {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
  });
}

function MovementControllerHarness({
  isArchived,
  payload
}: {
  isArchived: boolean;
  payload: ProductMovementMutationPayload;
}) {
  const controller = usePropertyMovementsController({
    isArchived,
    productId: 'product-1',
    tenantId: 'tenant-1'
  });
  // Keep a read of the query client in this harness so missing providers fail loudly.
  useQueryClient();

  return (
    <div>
      <p>dialog:{String(controller.dialogOpen)}</p>
      <p>items:{controller.items.length}</p>
      <p>loading:{String(controller.isLoading)}</p>
      <p>error:{String(controller.isError)}</p>
      <p>creating:{String(controller.isCreatingMovement)}</p>
      <button type='button' onClick={() => controller.setDialogOpen(true)}>
        open dialog
      </button>
      <button type='button' onClick={() => controller.handleCreateMovement(payload)}>
        create movement
      </button>
    </div>
  );
}

function mockMovementFetch() {
  return vi.fn((path: string, init?: RequestInit) => {
    if (path === '/api/products/product-1/movements?pageSize=8&order=desc') {
      return Promise.resolve(jsonResponse({ items: [], total: 0 }));
    }

    if (path === '/api/products/product-1/movements' && init?.method === 'POST') {
      return Promise.resolve(jsonResponse(movement, { status: 201 }));
    }

    return Promise.resolve(jsonResponse({}, { status: 404 }));
  });
}

function createMovementPayload(
  overrides: Partial<ProductMovementMutationPayload> = {}
): ProductMovementMutationPayload {
  return {
    description: 'Primer contacto',
    occurredAt: '2026-05-30T10:00:00.000Z',
    title: 'Llamada inicial',
    type: 'GENERAL_UPDATE',
    ...overrides
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: init.status ?? 200,
    ...init
  });
}
```

Important notes:

- If TypeScript requires exact `ProductMovement` literal types (`source`, `type`, etc.), add `satisfies` or explicit imports.
- If `invalidateQueries` mock return type causes async issues, make it `vi.fn().mockResolvedValue(undefined)`.
- The archived test expects only the initial GET request. If React Query schedules differently, assert no POST call rather than exact call count.
- If `sonner` produces warnings, mock it with success/error no-ops.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/use-property-movements-controller.test.tsx
```

Expected: FAIL because `use-property-movements-controller.ts` does not exist.

**Step 3: Create `use-property-movements-controller.ts`**

Create the hook module with these imports:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import { createProductMovement, getProductMovements } from '../api/service';
import type { ProductMovementMutationPayload } from '../api/types';
```

Implementation:

```ts
type UsePropertyMovementsControllerParams = {
  isArchived: boolean;
  productId: string;
  tenantId: string | null;
};

export function usePropertyMovementsController({
  isArchived,
  productId,
  tenantId
}: UsePropertyMovementsControllerParams) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const movementsQuery = useQuery({
    queryKey: productKeys.movements(productId, tenantId),
    queryFn: () => getProductMovements(productId)
  });
  const createMovementMutation = useMutation({
    mutationFn: (payload: ProductMovementMutationPayload) =>
      createProductMovement(productId, payload),
    onSuccess: async (_movement, payload) => {
      setDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: productKeys.movements(productId, tenantId)
        }),
        queryClient.invalidateQueries({
          queryKey: payload.newStatus ? productKeys.all : productKeys.detail(productId, tenantId)
        })
      ]);
      toast.success('Actualización agregada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar la actualización');
    }
  });

  function handleCreateMovement(payload: ProductMovementMutationPayload) {
    if (isArchived || createMovementMutation.isPending) {
      return;
    }

    createMovementMutation.mutate(payload);
  }

  return {
    dialogOpen,
    handleCreateMovement,
    isCreatingMovement: createMovementMutation.isPending,
    isError: movementsQuery.isError,
    isLoading: movementsQuery.isLoading,
    items: movementsQuery.data?.items ?? [],
    setDialogOpen
  };
}
```

Keep logic byte-for-byte equivalent to the current `product-form.tsx` movement block, only replacing `propertyEngagement.id` with `productId` and `propertyEngagement.tenantId` with `tenantId`.

**Step 4: Run controller tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/use-property-movements-controller.test.tsx
```

Expected: PASS after test-only adjustments if needed.

## Task 2: Replace movement logic in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.ts`

**Step 1: Import controller hook**

Add to `product-form.tsx` imports:

```ts
import { usePropertyMovementsController } from './use-property-movements-controller';
```

**Step 2: Use the controller in `PropertyEngagementDetails`**

Replace local movement dialog state/query/mutation/handler with:

```tsx
const movements = usePropertyMovementsController({
  isArchived,
  productId: propertyEngagement.id,
  tenantId: propertyEngagement.tenantId
});
```

Make sure `isArchived` is declared before the hook call.

**Step 3: Update existing JSX wiring only**

Header:

```tsx
<PropertyDetailHeader
  isAddingMovement={movements.isCreatingMovement}
  ...
  onAddMovement={() => movements.setDialogOpen(true)}
/>
```

History:

```tsx
<PropertyMovementHistory
  isError={movements.isError}
  isLoading={movements.isLoading}
  movements={movements.items}
/>
```

Dialog:

```tsx
<CreatePropertyMovementDialog
  open={movements.dialogOpen}
  isSubmitting={movements.isCreatingMovement}
  onOpenChange={movements.setDialogOpen}
  onSubmit={movements.handleCreateMovement}
/>
```

**Step 4: Remove no-longer-used movement code/imports from `product-form.tsx`**

Remove:

- `movementDialogOpen` state;
- `movementsQuery`;
- `createMovementMutation`;
- `handleCreateMovement`;
- imports `createProductMovement`, `getProductMovements`;
- type import `ProductMovementMutationPayload` if no longer used.

Keep:

- `useQueryClient` / `useMutation` if still used by restore/delete/image submit in this file.
- `productKeys` if still used by restore/delete/image submit in this file.

**Step 5: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/use-property-movements-controller.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-image-dialogs.test.tsx src/features/products/components/property-agents-section.test.tsx src/features/products/components/property-owner-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/queries.test.ts src/features/products/api/service.test.ts
```

Expected: PASS.

**Step 6: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/use-property-movements-controller.ts src/features/products/components/use-property-movements-controller.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/use-property-movements-controller.ts src/features/products/components/use-property-movements-controller.test.tsx
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 7: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.ts viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.test.tsx
git commit -m "refactor(products): extract property movements controller"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract property movements controller"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/use-property-movements-controller.test.tsx src/features/products/components/property-image-dialogs.test.tsx src/features/products/components/property-agents-section.test.tsx src/features/products/components/property-owner-section.test.tsx src/features/products/api/queries.test.ts src/features/products/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.ts
viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no movement behavior changes;
- query key and fetch function preserved;
- create movement success closes dialog;
- movement + detail/all invalidation branch preserved;
- archived/pending guards preserved;
- header/history/dialog layout stays unchanged;
- tests cover the sensitive invalidation flows.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product movements controller
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following previous ProductForm extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-movements-controller
gh pr create --base develop --head refactor/product-movements-controller --title "refactor(products): extract product movements controller" --body-file /tmp/viewpro-product-movements-controller-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected diff may exceed 400 lines because of docs + tests. If so, ask for explicit size-exception approval before opening the PR. If implementation grows into visual movement section extraction or dialog redesign, stop and split.

# ProductForm Agents Section Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract agent panel/dialog/query/mutation orchestration from `product-form.tsx` into a focused `PropertyAgentsSection` component without changing behavior.

**Architecture:** `product-form.tsx` remains the container for non-agent detail behavior. `PropertyAgentsSection` owns only agent-specific UI orchestration: `PropertyAgentsPanel`, `ManagePropertyAgentsDialog`, assignable-agent query, assign/remove/assign-all mutations, pending ids, toasts, guards, and `productKeys.all` invalidation.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, existing app-new UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- No behavior changes.
- Do not change agent API contracts.
- Do not change `PropertyAgentsPanel` or `ManagePropertyAgentsDialog` visuals/copy/API.
- Preserve assign/remove/assign-all semantics and toast text exactly.
- Preserve `productKeys.all` invalidation.
- Preserve query enabling: assignable agents query only when dialog open and not archived.
- Do not extract owner, movement, document, image, status, restore, or router behavior.
- Use pnpm, not Bun.

## Task 1: Add agents section component with tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.test.tsx`
- Modify later in Task 2: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`

**Step 1: Write failing component tests**

Create `property-agents-section.test.tsx` with focused tests:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssignableProductAgent, ProductAgent } from '../api/types';
import { PropertyAgentsSection } from './property-agents-section';

const assignedAgent: ProductAgent = {
  email: 'assigned@example.com',
  firstName: 'Ana',
  id: 'agent-assignment-1',
  userId: 'user-assigned-1'
};

const availableAgent: AssignableProductAgent = {
  email: 'available@example.com',
  firstName: 'Bruno',
  role: 'AGENT',
  userId: 'user-available-1'
};

const secondAvailableAgent: AssignableProductAgent = {
  email: 'second@example.com',
  firstName: 'Carla',
  role: 'MANAGER',
  userId: 'user-available-2'
};

describe('PropertyAgentsSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the agents dialog and loads assignable agents when active', async () => {
    const user = userEvent.setup();
    const fetchMock = mockAssignableAgentsResponse([availableAgent]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [assignedAgent] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findByRole('dialog', { name: /gestionar vendedores/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/assignable-agents',
      expect.objectContaining({ method: 'GET' })
    );
    expect(await screen.findByText('Bruno')).toBeInTheDocument();
  });

  it('does not open or load assignable agents when archived', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ isArchived: true });

    expect(screen.queryByRole('button', { name: /gestionar vendedores/i })).not.toBeInTheDocument();
    expect(screen.getByText('Restaurá la propiedad para gestionar vendedores.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('assigns one available agent through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [availableAgent] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'agent-assignment-2' }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection();

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /^asignar$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: availableAgent.userId }),
          method: 'POST'
        })
      );
    });
  });

  it('removes an assigned agent through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ deleted: true, id: assignedAgent.id }));
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [assignedAgent] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /^quitar$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/products/product-1/agents/${assignedAgent.id}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('assigns all available agents through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [availableAgent, secondAvailableAgent] }))
      .mockResolvedValue(jsonResponse({ id: 'agent-assignment' }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection();

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /sumar 2 vendedores/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: availableAgent.userId }),
          method: 'POST'
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: secondAvailableAgent.userId }),
          method: 'POST'
        })
      );
    });
  });
});

function renderPropertyAgentsSection({
  agents = [],
  isArchived = false,
  tenantId = 'tenant-1'
}: {
  agents?: ProductAgent[];
  isArchived?: boolean;
  tenantId?: string | null;
} = {}) {
  return render(
    <PropertyAgentsSection
      agents={agents}
      isArchived={isArchived}
      productId='product-1'
      tenantId={tenantId}
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

function mockAssignableAgentsResponse(items: AssignableProductAgent[]) {
  return vi.fn().mockResolvedValue(jsonResponse({ items }));
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

- If `apiFetch` includes extra request options (`cache`, `credentials`, `signal`), use `expect.objectContaining` as shown.
- If the GET request method is not explicitly set in service options, adjust the assertion to not require `method: 'GET'`; preserve service behavior, not the test assumption.
- If text appears multiple times, use role queries where possible.
- If toasts cause test warnings, mock `sonner` in the test file. Prefer avoiding toast assertions unless necessary.

**Step 2: Run tests to verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-agents-section.test.tsx
```

Expected: FAIL because `property-agents-section.tsx` does not exist.

**Step 3: Create `property-agents-section.tsx`**

Create the component with `'use client';` because it owns hooks, query, mutations, and toasts.

Imports:

```tsx
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { assignableProductAgentsOptions, productKeys } from '../api/queries';
import { assignProductAgent, removeProductAgent } from '../api/service';
import type { ProductAgent } from '../api/types';
import { ManagePropertyAgentsDialog, PropertyAgentsPanel } from './manage-property-agents-dialog';
```

Props:

```tsx
type PropertyAgentsSectionProps = {
  agents: ProductAgent[];
  isArchived: boolean;
  productId: string;
  tenantId: string | null;
};
```

Implementation outline:

```tsx
export function PropertyAgentsSection({
  agents,
  isArchived,
  productId,
  tenantId
}: PropertyAgentsSectionProps) {
  const queryClient = useQueryClient();
  const [agentsDialogOpen, setAgentsDialogOpen] = useState(false);
  const [assigningAgentUserId, setAssigningAgentUserId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const assignableAgentsQuery = useQuery({
    ...assignableProductAgentsOptions(tenantId),
    enabled: agentsDialogOpen && !isArchived
  });

  // move mutations and handlers from product-form.tsx exactly.

  return (
    <>
      <PropertyAgentsPanel
        agents={agents}
        isArchived={isArchived}
        isManageDisabled={
          assignAgentMutation.isPending ||
          removeAgentMutation.isPending ||
          assignAllAgentsMutation.isPending
        }
        onManage={handleOpenAgentsDialog}
      />
      <ManagePropertyAgentsDialog
        open={agentsDialogOpen}
        assignedAgents={agents}
        assignableAgents={assignableAgentsQuery.data?.items ?? []}
        assigningUserId={assigningAgentUserId}
        isAssignableAgentsError={assignableAgentsQuery.isError}
        isAssignableAgentsLoading={assignableAgentsQuery.isLoading}
        isAssigningAllAgents={assignAllAgentsMutation.isPending}
        removingAgentId={removingAgentId}
        onAssign={handleAssignAgent}
        onAssignAll={handleAssignAllAgents}
        onOpenChange={setAgentsDialogOpen}
        onRemove={handleRemoveAgent}
      />
    </>
  );
}
```

Make sure to import `useState` from React.

Move these exactly from `product-form.tsx`, replacing `propertyEngagement.id` with `productId`:

- assign one mutation;
- remove one mutation;
- assign all mutation;
- `handleOpenAgentsDialog`;
- `handleAssignAgent`;
- `handleAssignAllAgents`;
- `handleRemoveAgent`;
- `getAssignAllAgentsSuccessMessage`;
- `getAgentAssignmentErrorMessage`.

Expected mutation behavior to preserve:

```tsx
const assignAgentMutation = useMutation({
  mutationFn: (agentUserId: string) => assignProductAgent(productId, { agentUserId }),
  onMutate: (agentUserId) => {
    setAssigningAgentUserId(agentUserId);
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: productKeys.all });
    toast.success('Vendedor asignado');
  },
  onError: (error) => {
    toast.error(getAgentAssignmentErrorMessage(error, 'No se pudo asignar el vendedor'));
  },
  onSettled: () => {
    setAssigningAgentUserId(null);
  }
});
```

Keep remove and assign-all logic byte-for-byte except for `productId`.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-agents-section.test.tsx
```

Expected: PASS after adjusting tests to exact existing fetch options if necessary.

## Task 2: Replace agents wiring in ProductForm

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Modify if needed: `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx`

**Step 1: Import extracted section**

Add to `product-form.tsx` imports:

```ts
import { PropertyAgentsSection } from './property-agents-section';
```

**Step 2: Replace agents panel JSX**

Replace current `PropertyAgentsPanel` usage in the right aside with:

```tsx
<PropertyAgentsSection
  agents={propertyEngagement.agents}
  isArchived={isArchived}
  productId={propertyEngagement.id}
  tenantId={propertyEngagement.tenantId}
/>
```

**Step 3: Remove agent dialog JSX**

Remove the bottom-level `ManagePropertyAgentsDialog` usage from `PropertyEngagementDetails` because `PropertyAgentsSection` now renders it.

**Step 4: Remove agent state, query, mutations, handlers, helpers**

Remove from `PropertyEngagementDetails`:

- `agentsDialogOpen`
- `assigningAgentUserId`
- `removingAgentId`
- `assignableAgentsQuery`
- `assignAgentMutation`
- `removeAgentMutation`
- `assignAllAgentsMutation`
- `handleOpenAgentsDialog`
- `handleAssignAgent`
- `handleAssignAllAgents`
- `handleRemoveAgent`

Remove local helpers from `product-form.tsx`:

- `getAssignAllAgentsSuccessMessage`
- `getAgentAssignmentErrorMessage`

**Step 5: Remove no-longer-used imports from `product-form.tsx`**

Remove if unused after extraction:

- `assignableProductAgentsOptions`
- `assignProductAgent`
- `removeProductAgent`
- `ManagePropertyAgentsDialog`
- `PropertyAgentsPanel`

Keep `productKeys` if still used by movement/restore/status/image logic.

**Step 6: Run targeted tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-agents-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-section.test.tsx src/features/products/components/property-status-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/queries.test.ts src/features/products/api/service.test.ts
```

Expected: PASS.

**Step 7: Run type/lint/format checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/components/product-form.tsx src/features/products/components/property-agents-section.tsx src/features/products/components/property-agents-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/components/product-form.tsx src/features/products/components/property-agents-section.tsx src/features/products/components/property-agents-section.test.tsx
git diff --check
```

Expected: PASS. If Guardian flags only the pre-existing ProductForm monolith/product naming after all checks pass and fresh review confirms, parent may approve `--no-verify`.

**Step 8: Commit implementation**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx viewpro-app/apps/app-new/src/features/products/components/property-agents-section.test.tsx
git commit -m "refactor(products): extract property agents section"
```

If parent approves because Guardian only flags pre-existing monolith/naming after validation:

```bash
git commit --no-verify -m "refactor(products): extract property agents section"
```

## Task 3: Final validation and fresh review

**Files:**
- All files changed in this branch.

**Step 1: Run final validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-agents-section.test.tsx src/features/products/components/property-owner-section.test.tsx src/features/products/components/property-status-summary.test.tsx src/features/products/api/queries.test.ts src/features/products/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
git diff --check
```

Expected: PASS.

**Step 2: Run LSP diagnostics**

Check:

```txt
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx
viewpro-app/apps/app-new/src/features/products/components/property-agents-section.test.tsx
```

Expected: no diagnostics beyond unrelated pre-existing hints.

**Step 3: Fresh review**

Ask reviewer to confirm:

- no agent behavior changes;
- assignable-agents query enabled condition is preserved;
- assign/remove/assign-all mutation/toast/invalidation behavior is preserved;
- archived and concurrent mutation guards are preserved;
- `PropertyAgentsPanel` and `ManagePropertyAgentsDialog` visuals/copy/API are unchanged;
- non-agent behavior stayed in `product-form.tsx`;
- tests cover the sensitive agent flows.

## Task 4: Issue and PR

**Step 1: Create approved issue**

Issue title:

```txt
refactor(products): extract product agents section
```

Labels:

```txt
enhancement
status:approved
```

Issue body should explain this is a no-behavior-change ProductForm refactor following the owner/status/detail/image extractions.

**Step 2: Push branch and create PR**

```bash
git push -u origin refactor/product-agents-section
gh pr create --base develop --head refactor/product-agents-section --title "refactor(products): extract product agents section" --body-file /tmp/viewpro-product-agents-section-pr.md
```

PR label:

```txt
type:refactor
```

PR target: `develop`.

## Review budget forecast

Expected code diff is behavior-sensitive but bounded. If extraction grows into dialog redesign, agent API changes, owner/movement/document work, or query invalidation changes, stop and split.

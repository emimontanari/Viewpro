# ProductForm Movements Controller Refactor Design

This slice continues reducing `product-form.tsx` by extracting movement query/mutation state into a focused controller hook. It is a no-behavior-change refactor.

## Decision

Extract movement orchestration into `usePropertyMovementsController`, not a visual section yet.

| Area | Decision |
|------|----------|
| Scope | Movement state/query/mutation/controller logic only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/use-property-movements-controller.ts` |
| Tests | Add focused hook/controller tests. |
| Behavior | Preserve movement query, create mutation, archived/pending guards, toasts, and invalidation. |
| Layout | Keep header button, movement history, and dialog in their current JSX positions. |

## Why a hook instead of a section

The movement UI is split today:

- the “Agregar actualización” button lives in `PropertyDetailHeader`;
- `PropertyMovementHistory` renders lower in the card content;
- `CreatePropertyMovementDialog` mounts at the end of `PropertyEngagementDetails`.

A visual section extraction would either move UI or require an awkward imperative bridge. A controller hook removes the risky query/mutation logic while preserving layout exactly.

## Hook API

```ts
const movements = usePropertyMovementsController({
  isArchived,
  productId: propertyEngagement.id,
  tenantId: propertyEngagement.tenantId
});
```

Return shape:

```ts
{
  dialogOpen: boolean;
  handleCreateMovement: (payload: ProductMovementMutationPayload) => void;
  isCreatingMovement: boolean;
  isError: boolean;
  isLoading: boolean;
  items: ProductMovement[];
  setDialogOpen: (open: boolean) => void;
}
```

Names may be adjusted slightly during implementation if TypeScript or existing naming conventions make a better shape obvious, but behavior must not change.

## Behavior preservation requirements

The extracted hook must keep these exact behaviors:

- Movement query key remains `productKeys.movements(productId, tenantId)`.
- Movement query function remains `getProductMovements(productId)`.
- Successful create:
  - closes dialog;
  - invalidates movements key;
  - if `payload.newStatus` exists, invalidates `productKeys.all`;
  - otherwise invalidates `productKeys.detail(productId, tenantId)`;
  - shows `Actualización agregada`.
- Failed create shows `No se pudo agregar la actualización` or the error message.
- Archived properties cannot create movements.
- Pending create mutation blocks duplicate create calls.

## ProductForm after extraction

`product-form.tsx` keeps JSX placement:

```tsx
<PropertyDetailHeader
  isAddingMovement={movements.isCreatingMovement}
  onAddMovement={() => movements.setDialogOpen(true)}
/>

<PropertyMovementHistory
  isError={movements.isError}
  isLoading={movements.isLoading}
  movements={movements.items}
/>

<CreatePropertyMovementDialog
  open={movements.dialogOpen}
  isSubmitting={movements.isCreatingMovement}
  onOpenChange={movements.setDialogOpen}
  onSubmit={movements.handleCreateMovement}
/>
```

## What stays in `product-form.tsx`

- Header UI;
- movement history placement;
- movement dialog placement;
- restore behavior;
- owner, agent, document, image, status behavior;
- route navigation.

## Test plan

Add hook/controller tests for:

- loading movement history through the expected BFF route/key;
- create movement without `newStatus` invalidates movements + detail;
- create movement with `newStatus` invalidates movements + all;
- archived guard prevents create API calls;
- pending guard prevents duplicate create calls if practical.

Tests should use `QueryClientProvider` / `renderHook` or a small harness component, whichever fits current Testing Library/Vitest setup.

## Non-goals

- Do not move the Add Movement button.
- Do not redesign movement history.
- Do not change movement dialog fields/validation/copy.
- Do not change movement pagination (`pageSize=8&order=desc`).
- Do not change query invalidation strategy.
- Do not extract owner, agent, document, image, status, or restore behavior.

## Next step

Write the implementation plan, then implement this as a focused refactor PR targeting `develop`.

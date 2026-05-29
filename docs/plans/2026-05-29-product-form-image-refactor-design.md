# ProductForm Image Component Refactor Design

This slice reduces `product-form.tsx` size by moving presentational image components into a focused file. It is a no-behavior-change refactor.

## Decision

Extract only the low-risk image display components from `product-form.tsx`.

| Area | Decision |
|------|----------|
| Scope | Move presentational image components only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-images.tsx` |
| Tests | Add focused component tests in `property-images.test.tsx`. |
| Behavior | No API, mutation, query, toast, or copy changes. |
| Styling | Preserve existing classes and UI copy exactly. |

## Components to extract

Move these components:

- `PropertyImagePreview`
- `PropertyImageCarousel`
- `ExistingImagesSummary`

Keep these in `product-form.tsx` for now:

- state and mutations;
- upload/delete/primary handlers;
- preview dialog;
- delete confirmation dialog;
- query invalidation;
- form/editor orchestration.

This keeps the first refactor safe and avoids moving behavior-heavy code.

## Data flow

`product-form.tsx` continues to own all state and behavior. It imports the extracted components and passes the same props/handlers as before.

```txt
product-form.tsx
  ├─ owns data/mutations/handlers
  └─ renders property-images.tsx components
```

No API contracts or React Query keys change.

## Test plan

Add tests for extracted components:

- empty carousel state;
- active image and thumbnail rendering;
- thumbnail click callback;
- image fallback when load fails;
- existing image summary rendering;
- preview/delete callbacks;
- delete loading/disabled state for the pending image.

Targeted commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx src/features/products/components/property-document-requests.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
```

## Non-goals

- Do not refactor owner, agent, movement, or document-request logic.
- Do not extract mutation hooks.
- Do not change image upload/delete/set-primary behavior.
- Do not replace `<img>` with `next/image` in this slice.
- Do not redesign product detail UI.

## Next step

Write the implementation plan, then implement this as a small refactor PR targeting `develop`.

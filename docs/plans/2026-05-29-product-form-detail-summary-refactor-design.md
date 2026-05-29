# ProductForm Detail Summary Refactor Design

This slice continues reducing `product-form.tsx` by extracting detail-mode presentational UI. It is a no-behavior-change refactor.

## Decision

Extract the product detail header and read-only fact sections into a focused component module.

| Area | Decision |
|------|----------|
| Scope | Extract detail header and read-only sections only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-detail-summary.tsx` |
| Tests | Add focused component tests in `property-detail-summary.test.tsx`. |
| Behavior | No routing, mutation, query, toast, status, owner, agent, document, movement, or copy changes. |
| Styling | Preserve existing classes and Spanish UI copy exactly. |

## Components to extract

Move/introduce these exports:

- `PropertyDetailHeader`
- `PropertyReadOnlySections`

Move this helper into the new file as an internal implementation detail:

- `ReadOnlyField`

## What stays in `product-form.tsx`

`product-form.tsx` continues to own all behavior and orchestration:

- router calls;
- mutations;
- React Query invalidation;
- status select;
- archived-state aside;
- image carousel;
- owner card and owner invitation handlers;
- agents panel and dialog state;
- movement dialog/history;
- document request section;
- all dialogs.

The extracted header receives callbacks instead of importing router or owning mutation objects.

## Component APIs

### `PropertyDetailHeader`

Props:

```ts
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
```

Responsibilities:

- Render operation, status, property type, and archived badges.
- Render title and address/fallback text.
- Render city, surface, rooms, bedrooms, and owner email facts.
- Render the same action buttons with callbacks supplied by the parent.
- Hide edit/add-movement actions while archived and show restore action instead.

### `PropertyReadOnlySections`

Props:

```ts
type PropertyReadOnlySectionsProps = {
  propertyEngagement: Product;
};
```

Responsibilities:

- Render the existing “Información principal” section.
- Render the existing “Características” section.
- Preserve all labels, formatting, and `Sin dato` fallbacks.

## Data flow

```txt
product-form.tsx
  ├─ owns router/mutations/dialog state
  ├─ passes callbacks/flags into PropertyDetailHeader
  └─ passes product data into PropertyReadOnlySections
```

No API contracts or React Query keys change.

## Test plan

Add tests for extracted components:

- header renders badges, title, address, facts, and action buttons;
- header calls back/list, add movement, and edit callbacks;
- archived header shows restore and hides edit/add movement;
- read-only sections render core labels and values;
- read-only sections preserve `Sin dato` for missing numeric values;
- read-only sections format numeric suffixes like `m²` and `años`.

Targeted commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
```

## Non-goals

- Do not extract owner, agent, movement, or document-request behavior.
- Do not extract mutation hooks.
- Do not move `QuickStatusSelect` or `ReadOnlyStatusField`.
- Do not move `ArchivedStatePanel` in this slice.
- Do not normalize or rewrite formatting helpers beyond what the moved UI requires.
- Do not redesign detail layout.

## Next step

Write the implementation plan, then implement this as a small refactor PR targeting `develop`.

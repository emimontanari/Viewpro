# ProductForm Status Summary Refactor Design

This slice continues reducing `product-form.tsx` by extracting the detail aside price/status/archive summary. It is a no-behavior-change refactor.

## Decision

Extract the published price, quick status, and archived-state panel into a focused component module.

| Area | Decision |
|------|----------|
| Scope | Extract only the price/status/archive summary from the right detail aside. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-status-summary.tsx` |
| Tests | Add focused component tests in `property-status-summary.test.tsx`. |
| Behavior | No routing, owner, agent, movement, document, image, API, mutation, cache, toast, or copy changes. |
| Styling | Preserve existing classes and Spanish UI copy exactly. |

## Component to extract

Create this export:

```tsx
<PropertyStatusSummary
  isArchived={isArchived}
  propertyEngagement={propertyEngagement}
/>
```

It renders exactly the current:

- “Precio publicado” card;
- currency fallback (`currency ?? 'ARS'`);
- quick commercial status section with `QuickStatusSelect`;
- archived panel with date/reason when the property is archived.

Move these local helpers from `product-form.tsx` into the new file:

- `ArchivedStatePanel`
- `ReadOnlyStatusField`
- `formatPrice`

## What stays in `product-form.tsx`

`product-form.tsx` continues to own all orchestration and behavior:

- router calls;
- restore/movement/owner/agent mutations;
- React Query invalidation;
- image carousel;
- owner card and owner invitation handlers;
- agents panel and dialog state;
- movement dialog/history;
- document request section;
- all dialogs.

Owner and agent blocks remain in the right aside after `<PropertyStatusSummary />`.

## Data flow

```txt
product-form.tsx
  └─ aside
      ├─ PropertyStatusSummary(propertyEngagement, isArchived)
      ├─ PropertyOwnerCard(...existing owner props)
      └─ PropertyAgentsPanel(...existing agent props)
```

`PropertyStatusSummary` imports `QuickStatusSelect`, but does not change its mutation, toast, or cache behavior.

## Test plan

Add tests for extracted behavior:

- renders the published price label, formatted price, and currency;
- renders “Sin precio” when `publishedPriceCents` is `null`;
- renders the commercial status section;
- renders archived panel date/reason when `isArchived` is true;
- hides archived panel when `isArchived` is false.

Because `QuickStatusSelect` uses React Query, tests should render with a `QueryClientProvider` rather than mocking the component unless it becomes unnecessarily brittle.

Targeted commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-status-summary.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-detail-summary.test.tsx src/features/products/components/property-images.test.tsx src/features/products/components/property-owner-card.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
```

## Non-goals

- Do not extract owner card or owner invitation handlers.
- Do not extract agents panel or agent assignment handlers.
- Do not extract movement or document request behavior.
- Do not change `QuickStatusSelect` behavior.
- Do not move mutation hooks.
- Do not redesign aside layout.

## Next step

Write the implementation plan, then implement this as a small refactor PR targeting `develop`.

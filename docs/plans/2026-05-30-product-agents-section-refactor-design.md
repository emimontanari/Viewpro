# ProductForm Agents Section Refactor Design

This slice continues reducing `product-form.tsx` by extracting agent-specific orchestration into a focused component. It is a no-behavior-change refactor.

## Decision

Extract the agents panel, manage-agents dialog, assignable-agents query, agent mutations, pending state, guards, and agent-specific helper copy into `PropertyAgentsSection`.

| Area | Decision |
|------|----------|
| Scope | Agent UI orchestration only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx` |
| Tests | Add focused behavior tests in `property-agents-section.test.tsx`. |
| Behavior | Preserve assign, remove, assign-all, toasts, query enabling, guards, and invalidation. |
| Styling | Do not change `PropertyAgentsPanel` or `ManagePropertyAgentsDialog` markup/copy/classes. |

## Component to extract

Create this export:

```tsx
<PropertyAgentsSection
  agents={propertyEngagement.agents}
  isArchived={isArchived}
  productId={propertyEngagement.id}
  tenantId={propertyEngagement.tenantId}
/>
```

The component owns:

- `agentsDialogOpen`;
- `assigningAgentUserId`;
- `removingAgentId`;
- `assignableAgentsQuery`;
- `assignAgentMutation`;
- `removeAgentMutation`;
- `assignAllAgentsMutation`;
- `handleOpenAgentsDialog`;
- `handleAssignAgent`;
- `handleAssignAllAgents`;
- `handleRemoveAgent`;
- `getAssignAllAgentsSuccessMessage`;
- `getAgentAssignmentErrorMessage`.

It renders:

- `PropertyAgentsPanel`;
- `ManagePropertyAgentsDialog`.

## What stays in `product-form.tsx`

`product-form.tsx` continues to own all non-agent orchestration:

- router calls;
- restore and movement mutations;
- React Query behavior not tied to agents;
- image carousel/dialogs;
- status summary;
- owner section;
- movement dialog/history;
- document request section;
- all non-agent dialogs.

## Behavior preservation requirements

The extracted component must keep these exact behaviors:

- Assignable-agents query is enabled only when the manage dialog is open and the property is not archived.
- Archived properties cannot open the manage-agents dialog.
- Assign, remove, and assign-all handlers all block while archived.
- Assign, remove, and assign-all handlers block while any agent mutation is pending.
- Assign-all blocks on an empty selected list.
- Assign one:
  - sets `assigningAgentUserId` during mutation;
  - calls `assignProductAgent(productId, { agentUserId })`;
  - invalidates `productKeys.all`;
  - shows `Vendedor asignado`;
  - clears pending state on settle.
- Remove one:
  - sets `removingAgentId` during mutation;
  - calls `removeProductAgent(productId, agentId)`;
  - invalidates `productKeys.all`;
  - shows `Vendedor quitado`;
  - clears pending state on settle.
- Assign all:
  - calls `assignProductAgent(productId, { agentUserId })` for each selected user;
  - uses `Promise.allSettled` semantics;
  - invalidates `productKeys.all` once;
  - preserves full success, partial success warning, and full failure error messages.

## Data flow

```txt
product-form.tsx
  └─ aside
      ├─ PropertyStatusSummary(...)
      ├─ PropertyOwnerSection(...)
      └─ PropertyAgentsSection(productId, tenantId, agents, isArchived)
```

`PropertyAgentsSection` coordinates the existing agent UI components. It does not change their APIs.

## Test plan

Add tests for extracted behavior:

- renders the agents panel and opens the manage dialog when active;
- does not open the manage dialog when archived;
- fetches assignable agents only after opening the dialog;
- assigning one agent calls the correct BFF route/payload;
- removing one assigned agent calls the correct BFF route;
- assign-all calls one POST per selected available agent;
- optional: partial assign-all failure preserves the warning behavior if toast assertions are stable.

Tests should use `QueryClientProvider` and mocked `fetch`, matching existing product component tests.

## Non-goals

- Do not redesign the agents panel or dialog.
- Do not split `PropertyAgentsPanel` into a separate file in this slice.
- Do not change backend routes or service functions.
- Do not introduce narrower query invalidation.
- Do not change assign-all semantics.
- Do not extract owner, movement, document, image, status, or router behavior.

## Next step

Write the implementation plan, then implement this as a careful refactor PR targeting `develop`.

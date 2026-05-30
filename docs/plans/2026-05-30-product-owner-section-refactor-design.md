# ProductForm Owner Section Refactor Design

This slice continues reducing `product-form.tsx` by extracting owner-specific orchestration into a focused component. It is a no-behavior-change refactor, but it touches recent invitation behavior, so the boundary is intentionally explicit.

## Decision

Extract the owner card, link-owner dialog, invitation-link copy flow, and owner-specific state/mutations into `PropertyOwnerSection`.

| Area | Decision |
|------|----------|
| Scope | Owner UI orchestration only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx` |
| Tests | Add focused behavior tests in `property-owner-section.test.tsx`. |
| Behavior | Preserve link owner, invitation link rotation/copy, fallback, toasts, and query invalidation. |
| Styling | Do not change `PropertyOwnerCard` or `LinkPropertyOwnerDialog` markup/copy/classes. |

## Component to extract

Create this export:

```tsx
<PropertyOwnerSection
  isArchived={isArchived}
  productId={propertyEngagement.id}
  ownerEmail={propertyEngagement.property.ownerEmail}
  ownerName={propertyEngagement.property.ownerName}
  owners={propertyEngagement.property.owners}
/>
```

The component owns:

- `ownerDialogOpen`;
- `copyingInvitationOwnerId`;
- `manualInvitationFallback`;
- `linkOwnerMutation`;
- `handleOpenOwnerDialog`;
- `handleLinkOwner`;
- `handleCopyInvitationLink`;
- `getOwnerLinkErrorMessage`.

It renders:

- `PropertyOwnerCard`;
- `LinkPropertyOwnerDialog`.

## What stays in `product-form.tsx`

`product-form.tsx` continues to own all non-owner orchestration:

- router calls;
- restore/movement/agent mutations;
- React Query behavior not tied to owners;
- image carousel/dialogs;
- status summary;
- agents panel and dialog;
- movement dialog/history;
- document request section;
- all non-owner dialogs.

## Behavior preservation requirements

The extracted component must keep these exact behaviors:

- Archived properties cannot open the owner dialog.
- Archived properties cannot copy invitation links.
- Owner linking blocks while the link mutation is pending.
- Successful owner linking:
  - closes the dialog;
  - invalidates `productKeys.all`;
  - shows `Propietario vinculado`.
- Invitation link copy:
  - blocks while another invitation copy is pending;
  - clears existing manual fallback before requesting a new link;
  - calls `createProductOwnerInvitationLink(productId, owner.id)`;
  - writes `response.invitationUrl` to `navigator.clipboard`;
  - success toast: `Link de invitación copiado. Los links anteriores ya no funcionan.`
- Clipboard failure:
  - sets `manualInvitationFallback` for the matching owner;
  - warning toast: `No pudimos copiar automáticamente. Copiá el link manualmente.`
- API failure:
  - shows the existing error message fallback.
- Invalidates exactly `productKeys.all`; do not introduce narrower owner query keys in this refactor.

## Data flow

```txt
product-form.tsx
  └─ aside
      ├─ PropertyStatusSummary(...)
      ├─ PropertyOwnerSection(productId, owners, ownerName, ownerEmail, isArchived)
      └─ PropertyAgentsPanel(...)
```

`PropertyOwnerSection` coordinates the existing owner UI components. It does not change their APIs unless a test reveals a strictly necessary type-only adjustment.

## Test plan

Add tests for the extracted behavior:

- renders `PropertyOwnerCard` content and opens `LinkPropertyOwnerDialog` from “Vincular propietario”;
- submits a valid owner payload and calls the BFF owner link endpoint;
- closes the dialog and invalidates product queries after successful link;
- copies invitation URL to clipboard for invited owners;
- shows manual fallback when clipboard write fails;
- archived state prevents owner linking and invitation copy.

Tests should use `QueryClientProvider` and mock network calls through the same app-new testing pattern used for BFF services/components. Prefer testing observable behavior over internals.

## Non-goals

- Do not redesign owner UI.
- Do not modify `PropertyOwnerCard` visuals.
- Do not modify `LinkPropertyOwnerDialog` validation/copy.
- Do not change invitation token rotation semantics.
- Do not add email delivery.
- Do not add unlink/revoke owner management.
- Do not change query invalidation strategy.
- Do not extract agent/movement/document/image behavior.

## Next step

Write the implementation plan, then implement this as a careful refactor PR targeting `develop`.

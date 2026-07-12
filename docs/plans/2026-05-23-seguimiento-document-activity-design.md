# Seguimiento Document Activity Design

Seguimiento should become the agency's operational activity feed, not a separate documents module. The screen remains `/dashboard/seguimiento`, but it can show both property movements and document request activity with lightweight filtering.

## Decision

| Area | Decision |
| --- | --- |
| Navigation | Keep one top-level `Seguimiento` section. Do not add `/dashboard/documentos` yet. |
| Product model | Treat document requests as property activity. |
| Feed shape | Backend returns a discriminated activity union: `movement` and `document_request`. |
| Ordering | Backend owns chronological ordering and pagination. Do not merge independently paginated lists in the browser. |
| Detail behavior | Document cards link to the property detail where the Documents section already exists. |
| Scope guard | No emails, magic links, owner login, owner portal UI, automation, vencimientos, or standalone document detail route. |

## Why this is aligned

The roadmap's Stage 9 includes `Documents UX`, internal document review/status states, and the property detail as the operational center. Adding document activity to Seguimiento improves visibility of the document flow we just shipped without creating another section that competes with Properties, Movements, or future Owner Portal.

The user goal is to avoid a generic dashboard with infinite modules. This design keeps one mental model:

```txt
Seguimiento = what happened / what needs attention across properties
```

## User experience

Add a small kind filter near the existing filters:

```txt
Todo | Movimientos | Documentos
```

- `Todo`: chronological feed with movement and document activity.
- `Movimientos`: current behavior.
- `Documentos`: document request activity only.

Document cards should show:

- activity label: `Solicitud documental`;
- document request status;
- document title;
- optional description;
- property title/address summary;
- owner display name/email;
- requester display name/email;
- current version summary when present;
- action: `Ver propiedad`.

## Backend contract

Extend the existing activity feed or introduce an operational feed contract with this shape:

```ts
type ActivityFeedItem = MovementActivityItem | DocumentRequestActivityItem

type DocumentRequestActivityItem = {
  kind: 'document_request'
  id: string
  documentRequestId: string
  createdAt: string
  property: {
    engagementId: string
    title: string
    addressLine: string
    city: string
    province: string
    operationType: string
    status: string
  }
  owner: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    ownerFirstName: string
    ownerLastName: string
    accessStatus: string
  } | null
  requestedBy: {
    id: string
    email: string
    firstName: string | null
  }
  documentRequest: {
    title: string
    description: string | null
    status: string
    currentVersion: {
      id: string
      originalFilename: string
      status: string
      createdAt: string
    } | null
  }
}
```

Movement items should keep their current behavior but include `kind: 'movement'` so the frontend can render a discriminated union.

## Filters

Minimum filters for this slice:

- `kind`: `all | movement | document_request`.
- existing movement filters remain available.
- optional document status filter only if it stays simple and backend-supported.

If adding document status causes broad backend work, defer it. The essential value is seeing document activity in Seguimiento and filtering to `Documentos`.

## Permissions

Preserve existing rules:

- Managers see tenant-wide movement/document activity.
- Sellers see movement activity they are allowed to view and document requests they created unless they have manager-level document visibility.
- Cross-tenant or inaccessible records are not exposed.

## Acceptance criteria

- [ ] `/dashboard/seguimiento` still works for movements.
- [ ] The feed can show document request activity.
- [ ] `Todo | Movimientos | Documentos` filter works and persists in URL query state.
- [ ] Document activity cards contain enough context to identify property, owner, requester, document title, status, and date.
- [ ] Document card action opens the related property detail.
- [ ] Backend pagination/order is coherent for mixed activity.
- [ ] No new top-level documents section is added.
- [ ] No owner login/invitation/email flow is introduced.

## Out of scope

- Owner portal login or activation.
- Email/magic-link invitations.
- Notifications.
- Document detail route.
- Approve/reject actions directly from Seguimiento.
- Document templates/checklists/vencimientos.
- Analytics dashboard or KPIs beyond existing simple counters.

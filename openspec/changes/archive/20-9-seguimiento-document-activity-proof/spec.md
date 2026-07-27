# Spec — Stage 20.9 Seguimiento Document Activity Proof

## Slice Contract

```txt
Stage: 20
Slice: 20.9 — Seguimiento document activity proof
Objective: prove the document activity surface inside the Seguimiento feed across all document lifecycle states with automated tests, without redesigning the feature.
Evidence needed: component tests for ActivityDocumentRequestFeedItem covering all 5 doc statuses + 4 version statuses, use case tests for document_request mapping across all lifecycle states, seeded fixtures covering APPROVED + CANCELLED (currently missing), and seeded Playwright smoke that focalises on the document-card render and the document_request kind filter.
Do not touch: document storage, document panel redesign, document upload flow, new document workflows, the activity feed data model, the API 403 guard, or the 26.2 deterministic seed contract.
Done: every confirmed lifecycle state has a green test, the feed renders document activity correctly across states, and the seeded smoke proves the document-card flow end-to-end.
Next slice: 23.3 — WhatsApp tenant contact configuration (UI editor).
```

## Gap → FR Mapping

| Gap | FR | Assertion | Target file |
|-----|----|-----------|-------------|
| Gap 1: No component test | FR-1 | `ActivityDocumentRequestFeedItem` MUST render each of the 5 doc status labels | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 1: No component test | FR-2 | Each doc status badge MUST carry its tone CSS class (emerald/amber/sky/red/muted) | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 1: No component test | FR-3 | Component MUST render each of the 4 version status labels when `currentVersion` is present | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 1: No component test | FR-4 | Component MUST render "Sin archivo cargado" when `currentVersion` is null | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 1: No component test | FR-5 | Component MUST render fallback strings for missing property title, owner, and requester | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 1: No component test | FR-6 | "Ver propiedad" link MUST target `/dashboard/product/<engagementId>` | `activity-document-request-feed-item.test.tsx` (new) |
| Gap 2: Use case covers PENDING only | FR-7 | Use case mapper MUST produce correct `documentRequest.status` for all 5 doc statuses | `analytics.use-cases.spec.ts` (extended) |
| Gap 2: Use case covers PENDING only | FR-8 | Use case mapper MUST produce correct `currentVersion.status` for all 4 version statuses | `analytics.use-cases.spec.ts` (extended) |
| Gap 2: Use case covers PENDING only | FR-9 | Mixed-kind feed (`kind: 'all'`) MUST sort docs and movements by `createdAt desc`, ties by `id` desc | `analytics.use-cases.spec.ts` (extended) |
| Gap 3: Seed missing APPROVED/CANCELLED | FR-10 | Seed MUST produce at least one APPROVED doc request with an APPROVED version | `seed-demo.mjs` (additive) |
| Gap 3: Seed missing APPROVED/CANCELLED | FR-11 | Seed summary log MUST accurately reflect the new document request counts | `seed-demo.mjs` (additive) |
| Gap 4: Smoke is non-focal | FR-12 | Seeded smoke MUST assert a doc card renders with: status badge text, document title, owner display, requester display, "Ver propiedad" link | `demo-smoke.spec.ts` (extended) |
| Gap 5: No smoke for `kind=document_request` filter | FR-13 | Seeded smoke MUST assert that applying the `Documentos` pill shows only document cards and no movement cards | `demo-smoke.spec.ts` (extended) |

## Behavior Contract

### Document Status Enum

| Status | Label | Tone CSS class |
|--------|-------|----------------|
| `PENDING` | Pendiente | `border-amber-200 bg-amber-50 text-amber-700` |
| `SUBMITTED` | Subida | `border-sky-200 bg-sky-50 text-sky-700` |
| `APPROVED` | Aprobada | `border-emerald-200 bg-emerald-50 text-emerald-700` |
| `REJECTED` | Rechazada | `border-red-200 bg-red-50 text-red-700` |
| `CANCELLED` | Cancelada | `border-muted bg-muted/50 text-muted-foreground` |

### Version Status Enum

| Status | Label |
|--------|-------|
| `PENDING_UPLOAD` | Pendiente de carga |
| `UPLOADED` | Subida |
| `APPROVED` | Aprobada |
| `REJECTED` | Rechazada |

### Fallback Strings

| Condition | Fallback |
|-----------|----------|
| `item.documentRequest` is null/undefined | "Solicitud no disponible" (badge) |
| `documentRequest.currentVersion` is null | "Sin archivo cargado" |
| `item.property.title` is blank/empty | "Propiedad sin título" |
| `item.owner` is null | "Propietario" |
| `item.requestedBy?.firstName` and `item.requestedBy?.email` are falsy | "Solicitante no disponible" |

### Link Target

The "Ver propiedad" `<Link>` MUST have `href="/dashboard/product/<item.property.engagementId>"`.

### Sort Contract

When `kind: 'all'` and no movement `type` filter is applied, the merged feed MUST be sorted by `createdAt` descending. Ties (same `createdAt`) MUST be broken by `id` descending (lexicographic `localeCompare` on the string IDs).

## Acceptance Scenarios

### S-1 — Doc status PENDING renders correct label and tone
- GIVEN a rendered `ActivityDocumentRequestFeedItem` with `documentRequest.status = 'PENDING'`
- WHEN the component mounts
- THEN a badge with text "Pendiente" is visible
- AND the badge element contains class `bg-amber-50`

### S-2 — Doc status SUBMITTED renders correct label and tone
- GIVEN a rendered item with `documentRequest.status = 'SUBMITTED'`
- WHEN the component mounts
- THEN a badge with text "Subida" is visible
- AND the badge element contains class `bg-sky-50`

### S-3 — Doc status APPROVED renders correct label and tone
- GIVEN a rendered item with `documentRequest.status = 'APPROVED'`
- WHEN the component mounts
- THEN a badge with text "Aprobada" is visible
- AND the badge element contains class `bg-emerald-50`

### S-4 — Doc status REJECTED renders correct label and tone
- GIVEN a rendered item with `documentRequest.status = 'REJECTED'`
- WHEN the component mounts
- THEN a badge with text "Rechazada" is visible
- AND the badge element contains class `bg-red-50`

### S-5 — Doc status CANCELLED renders correct label and muted tone
- GIVEN a rendered item with `documentRequest.status = 'CANCELLED'`
- WHEN the component mounts
- THEN a badge with text "Cancelada" is visible
- AND the badge element contains class `bg-muted/50`

### S-6 — Version status PENDING_UPLOAD renders correct label
- GIVEN a rendered item with `currentVersion.status = 'PENDING_UPLOAD'`
- WHEN the component mounts
- THEN the text "Pendiente de carga" is visible inside the version section

### S-7 — Version status UPLOADED renders correct label
- GIVEN a rendered item with `currentVersion.status = 'UPLOADED'`
- WHEN the component mounts
- THEN the text "Subida" is visible inside the version section

### S-8 — Version status APPROVED renders correct label
- GIVEN a rendered item with `currentVersion.status = 'APPROVED'`
- WHEN the component mounts
- THEN the text "Aprobada" is visible inside the version section

### S-9 — Version status REJECTED renders correct label
- GIVEN a rendered item with `currentVersion.status = 'REJECTED'`
- WHEN the component mounts
- THEN the text "Rechazada" is visible inside the version section

### S-10 — Missing current version renders fallback text
- GIVEN a rendered item where `documentRequest.currentVersion` is null
- WHEN the component mounts
- THEN the text "Sin archivo cargado" is visible
- AND no version filename is rendered

### S-11 — Fallback strings for missing owner and requester
- GIVEN a rendered item where `item.owner` is null and `item.requestedBy` has no `firstName` and no `email`
- WHEN the component mounts
- THEN the text "Propietario" is visible in the owner meta section
- AND the text "Solicitante no disponible" is visible in the requester meta section

### S-12 — Use case mapper shape across all 5 doc statuses
- GIVEN `documentsRepository.listActivityRequests` returns fixtures for each of the 5 `DocumentRequestStatus` values
- WHEN `ListActivityFeedUseCase.execute` is called with `kind: 'document_request'`
- THEN each mapped item has `kind: 'document_request'`
- AND `item.documentRequest.status` equals the source record's status for all 5 values
- AND `item.documentRequest.currentVersion.status` equals the source version's status when present

### S-13 — Mixed-kind sort interleaves by `createdAt` desc
- GIVEN one movement at `2026-05-22T11:30:00Z` and one document request at `2026-05-22T11:00:00Z`
- WHEN `execute` is called with `kind: 'all'`
- THEN the movement appears first in `items`
- AND a document request at `2026-05-22T12:00:00Z` would appear before the movement

### S-14 — Seed produces an APPROVED doc fixture
- GIVEN a freshly seeded demo database (`pnpm demo:seed`)
- WHEN `listActivityRequests` is called for the demo tenant
- THEN at least one record with `status = 'APPROVED'` and a version with `status = 'APPROVED'` is returned

### S-15 — Seeded smoke asserts doc card renders with stable structure
- GIVEN the seeded demo and manager signed in at `/dashboard/seguimiento`
- WHEN the page loads with no filter applied
- THEN a card is visible with the "Solicitud documental" badge
- AND a doc status badge text is visible (e.g., "Aprobada")
- AND the "Ver propiedad" link is visible

### S-16 — Seeded smoke: `Documentos` filter shows only doc cards
- GIVEN the seeded demo and manager signed in at `/dashboard/seguimiento`
- WHEN the "Documentos" pill filter is clicked
- THEN all visible feed cards carry the "Solicitud documental" badge
- AND no card carries a movement-only indicator (e.g., movement type label without "Solicitud documental")

## Acceptance Map Table

| Scenario | FR(s) | Test file | Planned test name | Setup notes |
|----------|-------|-----------|-------------------|-------------|
| S-1 | FR-1, FR-2 | `activity-document-request-feed-item.test.tsx` | `renders PENDING status badge with amber tone` | Minimal item fixture; assert badge text + class |
| S-2 | FR-1, FR-2 | `activity-document-request-feed-item.test.tsx` | `renders SUBMITTED status badge with sky tone` | — |
| S-3 | FR-1, FR-2 | `activity-document-request-feed-item.test.tsx` | `renders APPROVED status badge with emerald tone` | — |
| S-4 | FR-1, FR-2 | `activity-document-request-feed-item.test.tsx` | `renders REJECTED status badge with red tone` | — |
| S-5 | FR-1, FR-2 | `activity-document-request-feed-item.test.tsx` | `renders CANCELLED status badge with muted tone` | — |
| S-6 | FR-3 | `activity-document-request-feed-item.test.tsx` | `renders PENDING_UPLOAD version label` | Include `currentVersion` with status |
| S-7 | FR-3 | `activity-document-request-feed-item.test.tsx` | `renders UPLOADED version label` | — |
| S-8 | FR-3 | `activity-document-request-feed-item.test.tsx` | `renders APPROVED version label` | — |
| S-9 | FR-3 | `activity-document-request-feed-item.test.tsx` | `renders REJECTED version label` | — |
| S-10 | FR-4 | `activity-document-request-feed-item.test.tsx` | `renders "Sin archivo cargado" when currentVersion is null` | Set `currentVersion: null` |
| S-11 | FR-5, FR-6 | `activity-document-request-feed-item.test.tsx` | `renders fallback strings and correct link target` | Null owner, no requester name/email; assert `href` |
| S-12 | FR-7, FR-8 | `analytics.use-cases.spec.ts` | `maps document_request items for all 5 doc statuses` | One fixture per status; assert mapped shape |
| S-13 | FR-9 | `analytics.use-cases.spec.ts` | `mixed-kind feed sorts by createdAt desc with id tiebreak` | Two items with different timestamps |
| S-14 | FR-10, FR-11 | `seed-demo.mjs` (verified via API call in smoke) | verified by S-15 smoke assertion | Additive fixture at `DEMO_NOW - N days` |
| S-15 | FR-12 | `demo-smoke.spec.ts` | `seeded smoke: doc card renders with stable structure` | Sign in as manager, open Seguimiento, assert badge + link |
| S-16 | FR-13 | `demo-smoke.spec.ts` | `seeded smoke: Documentos filter shows only doc cards` | Click "Documentos" pill; assert no movement-only cards |

## Non-Functional Notes

- Component tests use React Testing Library with `@testing-library/react` in JSDOM. The doc card uses only Badge, Card, and Link — no Radix Select/Popover interaction required.
- Seed fixtures for APPROVED (and CANCELLED if design accepts) MUST use timestamps derived from `DEMO_NOW` (the seed clock anchor `2026-06-01T12:00:00Z`) to keep sort order deterministic.
- New seed fixtures are strictly additive; the existing 26.2 seed contract is unchanged. The seed summary log MUST be updated atomically with any new fixture count.
- Pre-audit existing count assertions (e.g., `Document requests:` log line, `expectedTotal` in seller scenarios) before mutating the seed, per R-D3 from 20.11.

## Open Questions

None. The CANCELLED fixture decision (include or document as TODO) is deferred to the design phase per the proposal's risk note.

## Trace

| FR | Proposal Gap |
|----|-------------|
| FR-1, FR-2 | Gap 1 |
| FR-3 | Gap 1 |
| FR-4 | Gap 1 |
| FR-5, FR-6 | Gap 1 |
| FR-7, FR-8 | Gap 2 |
| FR-9 | Gap 2 |
| FR-10, FR-11 | Gap 3 |
| FR-12 | Gap 4 |
| FR-13 | Gap 5 |

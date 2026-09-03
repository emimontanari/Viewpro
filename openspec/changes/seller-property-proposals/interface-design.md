# Interface Design: Seller Property Proposals

## Normative status and scope

This companion is normative for the `seller-property-proposals` change. It defines REST, safe errors, BFF/client boundaries, App New route authorization, navigation, cache behavior, interface verification, and likely interface edit surfaces. [design.md](./design.md) is normative for data/state/auth transactions, canonical materialization, locks/concurrency, cleanup, and rollout.

The change covers 19 requirements and 49 scenarios. Sellers use proposal-specific authority and never gain direct canonical create. Managers retain the existing direct create path. Persisted `EN_REVISION` is displayed as `EN_REVISIÓN`; images, owner authorization, notifications, analytics, search, deletion, withdrawal, and manager proposal drafting remain absent.

## REST resources and authorization

`PropertyProposalsController` remains behind `AuthGuard`, `TenantMembershipGuard`, and `PermissionGuard`. Trusted request context supplies tenant and actor IDs. Use cases repeat exact active-role checks transactionally as described in the core design.

| Method and route | Audience | Result |
|---|---|---|
| `POST /property-proposals` | exact active `AGENT` + seller authority | create own draft, 201 |
| `GET /property-proposals` | seller | own-tenant list, 200 |
| `GET /property-proposals/:proposalId` | seller | own detail, 200 |
| `PATCH /property-proposals/:proposalId` | seller | update editable own proposal, 200 |
| `POST /property-proposals/:proposalId/submit` | seller | submit/resubmit, 200 |
| `GET /property-proposals/review` | manager/principal + review authority | tenant inbox, 200 |
| `GET /property-proposals/review/:proposalId` | reviewer | tenant detail, 200 |
| `POST /property-proposals/review/:proposalId/reject` | reviewer | decide current round, 200 |
| `POST /property-proposals/review/:proposalId/approve` | reviewer | decide/materialize current round, 200 |

Declare static `review` routes before `:proposalId`. Unknown body/query keys are rejected by the global whitelist/forbid policy. Seller predicates contain `tenantId` and `proposedByUserId`; wrong seller, wrong tenant, and absent ID return the same proposal 404. Reviewer predicates contain `tenantId`; wrong tenant and absent ID are indistinguishable. Permission failure happens before record lookup.

### Request contracts

```ts
type ProposalFieldsDto = {
  title: string
  addressLine?: string | null
  city?: string | null
  province?: string | null
  propertyType?: PropertyType | null
  operationType?: PropertyOperationType | null
  totalAreaSqm?: number | null
  coveredAreaSqm?: number | null
  rooms?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  garages?: number | null
  ageYears?: number | null
  orientation?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  publishedPriceCents?: number | null
  currency?: string | null
}

type UpdatePropertyProposalDto = Partial<ProposalFieldsDto> & { expectedVersion: number }
type SubmitPropertyProposalDto = { expectedVersion: number }
type ReviewPropertyProposalDto = { reviewRoundId: string }
type RejectPropertyProposalDto = ReviewPropertyProposalDto & { reason?: unknown }
```

DTO decorators validate transport shape for proposal fields, IDs, integers, enums, and versions. Rejection is deliberately different: `reason` is admitted by the whitelisted DTO (for example `@Allow()`/an equivalent non-verdict decorator), while the existing bounded HTTP body parser limits transport size. Do not add `@IsString`, `@IsNotEmpty`, or `@MaxLength(1000)` because decorator failures carry no proposal error code under the current global pipe.

`RejectPropertyProposalUseCase` is the one stable verdict owner for controller and direct invocation: require `typeof reason === 'string'`, trim once, reject blank or normalized length above 1000, and throw 400 with `PROPERTY_PROPOSAL_REJECTION_REASON_INVALID`. Persist and compare the normalized value. This prevents DTO validation from erasing the code and prevents unit/direct callers from bypassing validation.

Review replay requires the current durable round plus same actor and outcome; rejection also requires the same normalized reason. Active reviewer role and self-review checks precede replay success. Different actors after any decision receive `PROPERTY_PROPOSAL_STATE_CONFLICT` 409. Same-actor exact duplicates return authoritative detail with 200.

## Response contracts and result-link safety

Lists use `{ items, total, page, pageSize }`, page default 1, page size default 20/max 50. Seller order is `updatedAt DESC, id DESC`. Reviewer inbox defaults to `state=EN_REVISION` and orders `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC`.

Reviewer filters are only:

```ts
type ProposalReviewFilters = {
  state?: PropertyProposalStatus
  history?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  page?: number
  pageSize?: number
}
```

`history=NONE` means no rounds; `PENDING` means an undecided round; outcome values use an `EXISTS` decision. State and history combine with AND. `search` is unsupported and rejected.

Summary returns proposal ID/status/version/title/current round identity and timestamps. Reviewer summaries additionally include proposer display data. Detail adds staged fields and newest-first immutable history: each round has snapshot, submitter summary/time, and nullable decision containing outcome, reviewer summary/time, and rejection reason. Do not expose tenant or membership records as selectable response data.

`canonicalEngagementId` is optional and never mapped directly from the relation. A fresh scoped check emits it only when:

- the current reviewer is same-tenant and currently has `ENGAGEMENTS_VIEW_ALL`; or
- the current seller is same-tenant and currently has a `PropertyAgent` assignment to that engagement.

Missing engagement, cross-tenant relation, removed assignment, inactive actor, or lost capability omits the field. Proposer identity is not visibility. The canonical detail endpoint reauthorizes an emitted ID.

## Stable public errors

The newly accepted `safe-public-error-boundary` delta is authoritative. Runtime already contains a pre-existing exact 30-code ordered prefix (including the two landed primary-agent codes). Preserve that prefix byte-for-byte and append exactly these seven entries in order, producing exactly 37 codes:

1. `PROPERTY_PROPOSAL_NOT_FOUND`
2. `PROPERTY_PROPOSAL_STATE_CONFLICT`
3. `PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN`
4. `PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE`
5. `PROPERTY_PROPOSAL_REJECTION_REASON_INVALID`
6. `PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE`
7. `TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED`

| Code | HTTP use |
|---|---|
| `PROPERTY_PROPOSAL_NOT_FOUND` | 404 scoped absence |
| `PROPERTY_PROPOSAL_STATE_CONFLICT` | 409 stale version/round, locked state, actor/outcome/reason mismatch, race loser |
| `PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN` | 403 authorized viewer is durable proposer |
| `PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE` | 422 stored proposal lacks a required submit field |
| `PROPERTY_PROPOSAL_REJECTION_REASON_INVALID` | 400 non-string, blank, or over-1000 normalized reason |
| `PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE` | 409 proposer no longer active exact seller at approval |
| `TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED` | 409 proposal approval quota outcome |

Enabled `GlobalExceptionFilter` emits only `{ statusCode, errorCode, requestId }`; unknown/missing producer codes become `REQUEST_FAILED`. Exact tuple length/order/uniqueness, all known values, unknown/missing fallback, and the frozen 30-prefix require contract/runtime/API tests.

The shared capacity component raises a transport-neutral domain outcome. Approval maps it to the new quota code. Existing direct create and restore map it to their current message-only 409 response, preserving current external behavior rather than retroactively changing those contracts.

## BFF and browser client boundary

App BFF route handlers mirror `/api/property-proposals/**`, call `bffFetch`, and forward method/body/query. `bffFetch` derives the selected tenant from trusted request header/cookie behavior and must not accept a body-controlled tenant override.

`proxyJsonResponse` is a passthrough, not a sanitizer: it parses the backend JSON and returns that body unchanged with the selected status. Its only filtering is forwarding `x-request-id` when it is a canonical lowercase UUIDv4. Route tests must call this behavior “passthrough with request-ID filtering” and prove success/error status/body, canonical and invalid request IDs, malformed/no-body handling, query forwarding, and no tenant override. `proxyBffErrorResponse` handles BFF fetch failures/timeouts only.

Proposal feature services must use `bffRequest` and receive failures as `BffError`. `bffRequest` parses only status and a catalogued `errorCode`, captures only canonical request IDs, and constructs a generic error; arbitrary backend `message`, stack, and extra prose are discarded. UI copy branches on `hasErrorCode`/`BffError`, never raw backend text. Tests inject hostile backend prose and unknown codes and prove neither reaches rendered copy or thrown error serialization.

## Immutable App access policies and direct route boundaries

Export deeply immutable policies from one access module/config surface and reuse their exact objects everywhere:

```ts
export const sellerPropertyProposalAccess = deepFreeze({
  roles: ['AGENT'], permissions: ['property_proposals.seller']
})
export const reviewerPropertyProposalAccess = deepFreeze({
  roles: ['MANAGER', 'PRINCIPAL_MANAGER'], permissions: ['property_proposals.review']
})
```

`nav-config.ts`, Sidebar, KBar, seller layout/page boundaries, and reviewer layout/page boundaries all consume these policies through the existing fail-closed `canAccessNavigation`/access-context semantics. Do not duplicate inline role checks. Backend remains authoritative.

Every direct page boundary handles three states before mounting a data component:

1. unresolved/tenant switching/loading: render bounded loading and start no proposal query;
2. resolved unauthorized, inactive, wrong-role, missing-capability, or non-operational tenant: render/redirect to the established safe dashboard outcome and start no query;
3. resolved authorized: mount the audience-specific component and enable its query.

This applies independently to seller list/new/detail and reviewer inbox/detail, including direct URLs. Query `enabled` repeats resolved authorization so a child cannot fetch during a transient render. Tenant switching first disables old-context queries; the next authorized context uses a different key. Seller pages cannot render reviewer controls, reviewer pages cannot render draft controls, and no seller surface links to `/dashboard/product/new`.

Navigation destinations are:

- seller: `Propuestas de propiedades` → `/dashboard/property-proposals`;
- reviewer: `Revisión de propuestas` → `/dashboard/property-proposals/review`.

Sidebar and KBar use the same immutable policies and preserve the exact AGENT/MANAGER/PRINCIPAL_MANAGER/loading matrix in the navigation delta. Loading exposes baseline unprotected destinations only. Existing canonical “Nueva propiedad” continues to require `engagements.create`.

## App routes, forms, and cache

Create an independent `src/features/property-proposals/` feature and these pages:

```text
/dashboard/property-proposals
/dashboard/property-proposals/new
/dashboard/property-proposals/[proposalId]
/dashboard/property-proposals/review
/dashboard/property-proposals/review/[proposalId]
```

The proposal form owns title-minimum save and six-field submit validation. Save and submit are separate mutations; saving `RECHAZADA` never resubmits. No image control/upload runs. Detail displays state/history/rejection context. Approved detail links to `/dashboard/product/{canonicalEngagementId}` only when the backend supplies the optional ID.

Reviewer detail emphasizes the immutable current round. Approve/reject send that round ID, disable while pending, and use no optimistic success. Rejection UI applies the same trim/1..1000 rule for feedback, but server use-case validation remains authoritative.

Query keys always include active tenant and audience at every hierarchy level:

```ts
all(tenantId, audience)
lists(tenantId, audience)
list(tenantId, audience, normalizedFilters)
detail(tenantId, audience, proposalId)
```

Successful mutations invalidate relevant audience list/detail. Every 409 leaves no fabricated cache state, invalidates/refetches authoritative detail and lists, and shows local conflict copy. Approval also invalidates canonical product list/detail families. On tenant change, cancel/disable old-context proposal queries; distinct tenant keys prevent reuse.

## Interface verification

| Layer | Required RED evidence |
|---|---|
| Controller/E2E | all methods/routes/statuses, static route precedence, own/tenant 404 equivalence, permission bypass, current role, optional result ID visibility |
| DTO/use case | rejection non-string/blank/whitespace/1000/1001 and direct invocation retain the proposal code; unknown keys rejected |
| Contract/API filter | exact 37 tuple, exact frozen 30 prefix, seven-code append order, known passthrough, unknown/missing fallback, safe envelope |
| BFF route | method/path/body/query/status/body passthrough, canonical request-ID filtering, malformed body, timeout, selected-tenant handling |
| Client service | `bffRequest`/`BffError`, hostile prose discarded, unknown code discarded, local code mapping, timeout |
| Access/component | direct URL for every page, unresolved/loading suppression, inactive/wrong role/missing permission, tenant switching, seller/reviewer parity |
| Navigation | exact rendered Sidebar/KBar destinations for AGENT, MANAGER, PRINCIPAL_MANAGER, and retained loading membership |
| Cache/UI | tenant+audience keys, 409 refetch, no optimistic decision, approval canonical invalidation, approved link omission/appearance |
| Seeded E2E | approve and reject/edit/resubmit, seller lacks canonical create, manager direct create remains available |

Seeded tests use run-scoped fixtures and restore limits in `finally`. Seeded paths are now released after the landed develop baseline; apply must use fresh `origin/develop` containing current seeded invariants rather than preserve obsolete reservation comments.

## Likely interface edit surfaces

- `viewpro-app/packages/contracts/src/index.ts`
- `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`
- `viewpro-app/apps/api/src/permissions/permissions.constants.ts`
- `viewpro-app/apps/api/src/permissions/role-permissions.ts` and exact mapping tests
- `viewpro-app/apps/api/src/property-proposals/controllers`, `dto`, `responses`, mappers, and use cases
- `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts` tests (implementation only if needed)
- `viewpro-app/apps/api/test/property-proposals.e2e-spec.ts`
- `viewpro-app/apps/app-new/src/lib/bff-api.ts` tests (implementation reuse expected)
- `viewpro-app/apps/app-new/src/lib/bff-client.ts` tests (implementation reuse expected)
- `viewpro-app/apps/app-new/src/config/nav-config.ts`
- `viewpro-app/apps/app-new/src/lib/navigation-access.ts` and navigation fixtures/tests
- `viewpro-app/apps/app-new/src/features/property-proposals/**`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/**`
- `viewpro-app/apps/app-new/src/app/dashboard/property-proposals/**`
- Sidebar and KBar rendered parity tests
- `viewpro-app/apps/app-new/src/features/products/api/queries.ts` only if an exported invalidation key is required
- focused new seeded proposal spec plus narrowly required seeded helpers/fixtures

## Interface risks

| Risk | Control |
|---|---|
| Navigation hides a route but direct URL fetches | Shared immutable policy at every page and query boundary |
| BFF is mistaken for sanitization | Document/test body passthrough; rely on `bffRequest` to discard prose |
| DTO emits generic rejection error | Use case owns type/normalization/length verdict |
| Result link leaks canonical identity | Backend fresh visibility check and optional field |
| Tenant switch displays cached data | tenant+audience keys and authorization-gated query enablement |
| Principal manager inherits seller permission | explicit role permission sets and exact mapping tests |

## Rollout boundary

No feature flag is added. Backend schema/contracts/permissions/routes deploy and verify first; BFF follows; frontend pages/navigation are exposed last. Rollback removes UI/navigation and routes first, then rolls back backend only to a schema/contract-compatible binary. Existing proposal/history/canonical data is preserved.
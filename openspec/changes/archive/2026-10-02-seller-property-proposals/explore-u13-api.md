# U13 API Exploration

## Status and fixed boundaries

- OpenSpec is apply-ready and U12 is complete; native `gentle-ai sdd-status` was unavailable to this read-only explorer.
- U13A is contracts/projection/tests only: no controller, module/AppModule mounting, endpoint, Prisma/repository query, or C9A source edit. U14 retains every `/review` route and reviewer DTO.
- Global `ValidationPipe` already has `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`; DTO decorators therefore must admit every supported key and reject `tenantId`, `proposedByUserId`, source/relation keys, and all unknown keys.

## U13A exact contract seam

- Add `ProposalFieldsDto` with exactly `title`, `addressLine`, `city`, `province`, `propertyType`, `operationType`, `totalAreaSqm`, `coveredAreaSqm`, `rooms`, `bedrooms`, `bathrooms`, `garages`, `ageYears`, `orientation`, `ownerName`, `ownerEmail`, `publishedPriceCents`, and `currency`; `title` is required, all other fields permit omission or `null` as the accepted interface declares. Reuse current canonical string/enum/integer/email bounds; title completeness remains the use-case verdict.
- `CreatePropertyProposalDto` is the fields contract. `UpdatePropertyProposalDto` is its all-optional counterpart plus required integer `expectedVersion`. `SubmitPropertyProposalDto` contains only required integer `expectedVersion`. `ListPropertyProposalsQuery` contains only transformed positive `page` and `pageSize` (default 1/20, max 50). `PropertyProposalIdParams` contains only UUID `proposalId`.
- Add one pure transport projector and focused spec. It literal-allowlists public proposal scalars/timestamps and optional C9A `ProposalResultLink`; it never spreads a Prisma record and excludes `tenantId`, `proposedByUserId`, `sourceEngagement`, `sourceProposalId`, assignment, membership, and user records. It performs no query and receives no snapshot service.
- Keep `responses/property-proposal.response.ts` byte-for-byte: only U13B may freshly batch viewer, membership, same-tenant source-engagement, and seller-assignment reads, call the existing pure resolver, and pass its omitted-or-authorized result link to the projector.
- The normative response text requires a “current round identity” and history but does not name their public fields or provide the current/history read shape. Do not invent names or expose raw relations in U13A; this is an interface-contract gap to resolve before a mounted detail/list response can claim conformance, not a business decision.

## U13A1 strict TDD, paths, and budget

- The discarded DTO/projection prototype measured **575 physical lines** before progress closure; it was not delivered. The user approved U13A1 DTO-only scope, with projection deferred to U13A2.
- U13A1 permits only the six DTO paths and `dto/property-proposal-transport.spec.ts`. It excludes projection, controllers/modules/endpoints, queries, role checks, and C9A response sources.
- Run RED → GREEN → TRIANGULATE → REFACTOR with `pnpm --filter @viewpro/api exec vitest run --retry=0 src/property-proposals/dto/property-proposal-transport.spec.ts` twice, after the localhost `_test` URL guard; then typecheck and lint. No body coercion is allowed; query conversion is explicit.
- Before source work, account for the whole working-tree diff and native cumulative 87: the final total must be ≤400 and the newly consumed delta ≤313.

## U13B1 resolved seller-list contract

- Seller list summaries expose only `id`, `state`, `version`, `title`, `currentReviewRoundId` when a tenant-scoped round exists, `latestSubmittedAt`, `createdAt`, `updatedAt`, and an already-authorized optional `canonicalEngagementId`.
- The envelope remains `{ items, total, page, pageSize }` with `updatedAt DESC, id DESC`; no staged detail fields, tenant/proposer/source references, relations, assignment, membership, or raw users are public.
- The repository loads the current viewer plus exact tenant membership once, current round IDs in one tenant-scoped page batch, same-tenant source engagements in one page-ID batch, and matching assignments in one batch; it passes only this fresh snapshot to the C9A resolver.
- U13B1 is list-only. Seller detail/history shaping stays in U13B2, while controller/module/endpoint integration remains U13C.

## Approved U13B/U13C follow-up boundaries

- The approved split is U13A → U13B → U13C, each with a hard under-400 physical-line boundary. U13B owns safe seller reads, current/history shaping, and fresh current visibility without controller or module mounting. It must resolve the unnamed current-round/history public fields before claiming a detailed response contract.
- U13C owns seller endpoints, controller/module/AppModule mounting, and transport integration/controller/E2E tests after U13B. It is the only slice that may claim the aggregate seller-route U13 task complete.
- U13A excludes raw persistence exposure, all reviewer transport, schema/migrations, BFF/UI, notification/analytics/image/owner work, and publication.

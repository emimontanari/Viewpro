# C7A2 Exploration — Reviewer Repository

## Scope and status

- Change: `seller-property-proposals`; artifact store: OpenSpec.
- C7A2 is the pending U8 repository-GREEN slice after C7A1. Its task manifest is exactly `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, and `prisma-property-proposals.repository.spec.ts`.
- The native status output cannot be independently executed by this read-only explorer. The latest authoritative progress record reports `applyState: ready`, `next: apply`, and `31/79`, but names the prior C7A1 workspace. The requested C7A2 status invocation must confirm `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7a2-reviewer-repository` before apply.
- Excluded: reviewer use cases/roles/module wiring, result-link visibility (U10B), search rejection (U14), all writes/commands, transport/DTO/BFF/UI, and C8+.

## Existing contract to consume

C7A1 supplies `PropertyProposalReviewFilters`, `normalizeReviewerRead`, `buildReviewerWhere`, and `buildReviewerSqlPredicate`.

- Normalization defaults to `state: EN_REVISION`, page 1, page size 20, maximum 50, and a safe `skip`; it preserves optional history.
- Prisma predicate is tenant-first and combines state with history by AND: `NONE` has no same-tenant rounds; `PENDING` has a same-tenant round with no decision; `REJECTED`/`APPROVED` have same-tenant round and same-tenant decision with that outcome.
- The raw predicate is tenant-correlated through `r."tenantId" = p."tenantId"` and `d."tenantId" = p."tenantId"`; it has the equivalent EXISTS/NOT EXISTS semantics and state bind.
- Migration `20260902120000_add_property_proposals` creates the raw expression inbox index: `(tenantId, state, COALESCE(latestSubmittedAt, createdAt) DESC, id DESC)`.

## Implementation map

### Port

Add reviewer-only port types and methods beside the existing seller reads:

- `ReviewerPropertyProposalsPage = { items: PropertyProposal[]; total: number }`.
- `listForReviewer({ tenantId, filters: PropertyProposalReviewFilters }): Promise<ReviewerPropertyProposalsPage>`.
- `findForReviewer({ tenantId, proposalId }): Promise<PropertyProposal | null>`.

The port takes tenant identity explicitly and takes no reviewer role/capability/actor input. C7B owns those use-case checks and mapping. Detail deliberately has no inbox state/history filters: authorized reviewers may inspect every state; its only repository scope is `id + tenantId`.

### Prisma adapter

1. Normalize exactly once in `listForReviewer` with `normalizeReviewerRead(filters)`.
2. Derive the Prisma count predicate with `buildReviewerWhere(tenantId, normalized)` and use the same object in `propertyProposal.count`.
3. Fetch the page IDs through `$queryRaw` using `Prisma.sql`, with the raw predicate from `buildReviewerSqlPredicate(normalized)`:

```sql
SELECT p.id
FROM "property_proposals" p
WHERE p."tenantId" = $tenantId
  <C7A1 state/history predicate>
ORDER BY COALESCE(p."latestSubmittedAt", p."createdAt") DESC, p.id DESC
OFFSET $skip LIMIT $pageSize
```

4. Hydrate only those IDs through `propertyProposal.findMany({ where: { tenantId, id: { in: ids } } })`; do not add future round/decision/source-engagement includes or response mapping.
5. Reconstruct the raw order with an ID-to-proposal map and `ids.flatMap(...)`, so Prisma's unordered `IN` result cannot alter the required expression ordering. Returning an item only when it was hydrated is the safe concurrent-deletion behavior.
6. Run raw IDs, count, and hydration concurrently only if their exact dependency permits it: the raw IDs must finish before hydration, while count may run in parallel with the raw-ID query. This preserves the same request predicate while avoiding an empty-ID `findMany` call.
7. Implement `findForReviewer` as one `propertyProposal.findFirst({ where: { id: proposalId, tenantId } })`; `null` is the identical absence for missing ID and cross-tenant ID.

Raw bind order must be asserted rather than interpolated: `[tenantId, state?, historyOutcome?, skip, pageSize]`. For no optional state/history values, it is `[tenantId, skip, pageSize]`; normal C7A1 normalization provides the default state, so the practical default list bind sequence includes `EN_REVISION`. The tests should inspect the `Prisma.Sql` object's normalized strings and values, never assert a database-specific `$1` representation.

## Tenant and predicate parity

- List raw SQL begins with `p."tenantId" = tenantId`; every history subquery correlates its round/decision tenant to the outer proposal tenant, not merely to a caller value.
- Count receives `buildReviewerWhere` from the same normalized filters and must retain `tenantId` in its top-level predicate.
- Hydration repeats `tenantId` with the selected IDs. This guards against cross-tenant IDs even though the raw query is scoped.
- Detail repeats `id + tenantId`; missing and another tenant's ID both yield `null`, with no history, fields, or existence signal.
- `NONE`, `PENDING`, `REJECTED`, and `APPROVED` are history predicates, not proposal-state aliases. State and history stay ANDed for both raw list and Prisma count; `PENDING` means any undecided same-tenant round.

## Focused test plan

Extend the existing repository spec only.

1. Add a reviewer Prisma mock exposing `$queryRaw`, `propertyProposal.count`, `propertyProposal.findMany`, and `findFirst`.
2. Assert default list uses `EN_REVISION`, page 1/page size 20/skip 0, exact count `where`, raw tenant/state/offset/limit binds, and no relation includes.
3. Parameterize all history values with a non-default state and prove count's C7A1 `where` and raw SQL predicate are exact equivalents, including correlated round/decision tenant clauses and outcome binding.
4. Mutate one list predicate test at a time—remove the outer tenant scope, replace AND with an alternative, remove a round/decision tenant correlation, or use divergent count filters—and require the relevant exact assertion to fail before restoration.
5. Return raw IDs in newest-first order while hydration returns a deliberately scrambled subset. Assert output follows raw IDs, ties resolve by `id DESC`, and a missing hydrated ID is omitted rather than replaced/reordered.
6. Assert raw ordering text is exactly `ORDER BY COALESCE(p."latestSubmittedAt", p."createdAt") DESC, p.id DESC`; a `latestSubmittedAt` null case is necessary to prove the fallback rather than an ordinary timestamp order.
7. Assert pagination bindings at a nonzero normalized page and rejected invalid/over-limit inputs through the already-landed C7A1 normalization contract.
8. Assert reviewer detail calls one `findFirst` scoped only by ID and tenant, with `null` for missing and wrong-tenant inputs and no includes.

### Strict RED

The current repository/spec imports already resolve, so the first test may call the absent `listForReviewer`/`findForReviewer` contract directly and fail as an assertion/`TypeError`, not as a missing-import or zero-collected-test failure. Before claiming behavioral RED, add only a compiling skeletal port/adapter implementation that returns an empty or deliberately unscoped result, then rerun the same collected tests. The required RED is the concrete failed assertion over raw tenant/predicate binds, count parity, ordered hydration, or detail scope. Do not record a missing-module/import failure as RED. GREEN is the smallest port/adapter implementation above; TRIANGULATE restores each bounded predicate/order mutant; REFACTOR is limited to factoring local raw-ID/hydration plumbing with tests unchanged.

## OpenSpec and budget

- Mark only the two C7A2 implementation-owned rows in `tasks.md` `[x]` after the actual GREEN, focused repository verification, typecheck, fixture cleanup, and exact ordering evidence.
- Append factual C7A2 status, TDD, command result, cleanup, residual-risk, and line-accounting evidence to `apply-progress.md`.
- `task-delivery-plan.md`, `task-evidence-matrix.md`, and `task-verification-commands.md` already assign C7A2 its 190–240 line C7A2 boundary and exact command; do not edit them unless implementation evidence proves an actual correction is needed.
- Forecast: 190–240 changed lines across the three source/test paths, plus only necessary tasks/progress artifact closure. This fits the normal 400-line budget; no `size:exception` is indicated.

## Exact allowed edit paths

Implementation paths:

- `viewpro-app/apps/api/src/property-proposals/property-proposals.repository.ts`
- `viewpro-app/apps/api/src/property-proposals/prisma-property-proposals.repository.ts`
- `viewpro-app/apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts`

Artifact closure paths after successful implementation:

- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

No schema/migration, mapper/response, use-case, module, controller, DTO, role, BFF, UI, search, command/write, U10B, or C7B/C8+ path is allowed.

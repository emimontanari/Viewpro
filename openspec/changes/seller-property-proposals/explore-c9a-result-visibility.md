# C9A / U10B Exploration — Result Visibility (#306)

## Status and authority

- **Skill resolution:** `none`; no phase-skill path was injected.
- **Change/worktree:** `seller-property-proposals` in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c9a-result-visibility`; OpenSpec is the active store.
- The requested authoritative command is `gentle-ai sdd-status seller-property-proposals --cwd /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c9a-result-visibility`. This read-only executor has no command tool, so it was not executed or substituted with autodetection. Local OpenSpec evidence records C8B/U10A complete and U10B as the next unchecked implementation boundary.
- The selected source topology replaces combined C9: **C9A = U10B result visibility now**; **C9B = U11A quota/proposer eligibility later**. C9A is not approval replay/races (U11B), transport/module registration (U13), DTO/controller/BFF/UI, schema/migration, or provider work.

## Inputs reconciled

Read: repository `AGENTS.md`, live execution ledger, change proposal/design/tasks/interface/evidence/delivery/verification artifacts, merged C7A1/C7A2/C7B reviewer-read records, C8A rejection and C8B approval records, Prisma schema, approval/materializer flow, proposal repository/use-case outputs, canonical detail visibility, and role-permission mappings.

C8B creates a unique same-tenant `PropertyEngagement.sourceProposalId`, materializes an ordinary `PropertyAgent` assignment for the proposer, and returns the raw updated `PropertyProposal` without a canonical ID. C7B likewise returns raw `PropertyProposal` records. There is currently no proposal response mapper or mounted proposal transport, so no existing result field is accidentally exposed.

## Recommendation: fail closed at a viewer-aware read boundary

`canonicalEngagementId` is an **optional omitted property**, never `null`, and is never copied from `proposal.sourceEngagement` or `sourceProposalId`.

A pure mapper cannot satisfy the requirement: it has neither authoritative current actor authority nor durable canonical assignment data. Keep the mapper pure and pass it only a pre-authorized ID (or `undefined`); put fresh lookup/authority resolution in the response orchestration that owns the viewer context. That orchestration is not a C9A production edit surface. C9A should therefore define and unit-test the mapper input/output contract, while U13's first controller/read-response wiring must call the fresh resolver before mapping. If the user requires U10B itself to prove a live lookup, the allowed surface must explicitly expand to a small viewer-visibility resolver and the relevant reader use cases; do not hide Prisma access in a nominal mapper.

### Canonical eligibility predicate

For every proposal response candidate, first find the canonical engagement by all of:

1. `id` is the durable source engagement for this proposal (or equivalently `sourceProposalId = proposal.id`);
2. `engagement.tenantId = active tenantId`; and
3. it remains an actual same-tenant canonical row.

Then qualify the current viewer afresh, with the user and exact tenant membership active at lookup time:

- **Seller owner:** viewer is the proposal's durable proposer; active membership role is exactly `AGENT` with current seller/proposal and assigned-engagement authority; and a `PropertyAgent` row exists for `(tenantId, engagementId, agentUserId)`. The assignment, not proposer identity or `isPrimary`, is the canonical visibility proof.
- **Reviewer:** viewer is an active same-tenant `MANAGER` or `PRINCIPAL_MANAGER`, still has proposal-review authority and `ENGAGEMENTS_VIEW_ALL`; no assignment is required.

A missing engagement/source relation, tenant mismatch, absent/removed assignment, inactive user or membership, role change, or missing required capability yields `undefined`. It produces no distinct error, no null sentinel, no candidate ID, and no existence signal. Canonical detail remains independently authorized through `GetPropertyEngagementUseCase`; an emitted ID is navigation data, not a grant.

The authoritative role catalog currently gives both reviewer roles `PROPERTY_PROPOSALS_REVIEW` and `ENGAGEMENTS_VIEW_ALL`, and gives `AGENT` proposal-seller plus `ENGAGEMENTS_VIEW_ASSIGNED`; the resolver must nevertheless test current role/capability rather than trusting a stale request context. A future dynamic-capability model must query its authoritative grant source rather than infer permissions from an old session.

## Response contract

C9A introduces only the additive response-field contract:

```ts
type ProposalResultLink = {
  canonicalEngagementId?: string
}
```

- In seller and reviewer **list summaries**, emit the field only for an approved proposal after the matching viewer check; otherwise omit it. List orchestration must resolve eligibility in a tenant-scoped batch, not N+1 mapper queries.
- In seller and reviewer **detail**, apply the same predicate for the same optional field. Detail does not become more permissive than list.
- Existing list envelopes remain `{ items, total, page, pageSize }`. Existing raw `PropertyProposal` use-case returns are not an HTTP contract and must not be widened with relation IDs.
- U10B does not introduce a source-engagement object, `sourceProposalId`, tenant ID, assignment ID, membership ID, or any fallback identifier. History/staged-field/proposer response shaping and first transport conversion remain their assigned later work.

## Strict TDD and verification

Add only:

- `viewpro-app/apps/api/src/property-proposals/responses/property-proposal.response.ts`
- `viewpro-app/apps/api/src/property-proposals/responses/property-proposal.response.spec.ts`

RED must be collected behavioral assertions against a compiling mapper seam, not a missing-file/import failure. Cover: assigned active same-tenant seller emits exactly one canonical ID; active qualified manager/principal reviewer emits it without assignment; and missing source, cross-tenant source, removed assignment, inactive user/membership, seller role/capability loss, reviewer role/capability loss, and absent source all omit the property with no ID leakage. Triangulate by temporarily direct-mapping the relation and by accepting a stale assignment/capability; each must fail. GREEN is the smallest pure optional-field mapper; REFACTOR may only improve local response typing.

Do not run commands in this exploration. Later C9A verification is exactly:

```sh
pnpm --filter @viewpro/api exec vitest run src/property-proposals/responses/property-proposal.response.spec.ts
pnpm --filter @viewpro/api typecheck
```

No DB, installation, migration, provider, external service, or Git action belongs to C9A. The focused test must remove any test assignment/canonical fixture in `finally` if its resolver seam is expanded by an explicitly authorized later correction.

## Forecast, cleanup, and exclusions

The U10B source/test budget remains 130–170 lines. This exploration plus required factual task/progress/topology closure is forecast at 90–125 lines, for an honest C9A candidate of **220–295 changed lines**, below the 400-line budget without `size:exception`. The future C9B/U11A remains a separate 165–200-line quota/proposer-eligibility unit; U11 replay/race stays separately owned.

C9A changes neither Prisma/schema/migration nor `CanonicalPropertyMaterializer`, approval/rejection/replay/quota behavior, module/controller/DTO/BFF/UI, provider registrations, canonical detail authorization, permissions, owner/image/notification/analytics behavior, or publication. Cleanup is limited to removing local test objects if introduced; this exploration made none.

## Resolved apply decision

The user selected the C9A response-local resolver plus optional mapper. The resolver accepts only a fresh, viewer-specific current-read snapshot and fail-closes before returning a pre-authorized ID; it remains unmounted until U13, which must supply the fresh lookup and response wiring. It neither queries Prisma nor broadens the C9A response surface into reader integration.

Revised physical forecast: 80 existing exploration lines + 70 resolver lines + 120 focused-spec lines + 2 task lines + at most 70 cumulative progress lines = **342 changed lines**, below the 400-line C9A cap. No size exception is needed.

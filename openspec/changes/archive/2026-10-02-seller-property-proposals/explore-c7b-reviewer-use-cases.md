# C7B Exploration — Reviewer Read Use Cases

## Status and planning root

- **Skill resolution:** `none` (no phase-skill path was injected).
- This read-only exploration was performed against workspace root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7b-reviewer-use-cases`, application workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7b-reviewer-use-cases/viewpro-app`, and planning/change root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7b-reviewer-use-cases/openspec/changes/seller-property-proposals`.
- Native SDD-status execution is not exposed to this executor. Local authoritative evidence establishes `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`; C7A2 began at 31/79 and marked exactly its two implementation rows complete, so the requested current task state is **33/79**. C7B's two rows remain unchecked.
- `openspec/config.yaml` names `viewpro-app` as the workspace; its `repo_root` is the canonical checkout path, not the active worktree. Apply work must remain in the workspace above.

## Merged C7A contracts to consume

C7A1 supplies `PropertyProposalReviewFilters` and `normalizeReviewerRead`: default `state=EN_REVISION`, page 1, page size 20, max 50, safe offset, and optional `history`. C7A2 supplies the complete read port:

```ts
listForReviewer({ tenantId, filters }): Promise<{ items: PropertyProposal[]; total: number }>
findForReviewer({ tenantId, proposalId }): Promise<PropertyProposal | null>
```

The repository alone implements tenant-correlated state/history predicates, count parity, raw `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC` ordering, pagination, hydration order, and detail's safe `id + tenantId` absence. It neither accepts actor/role/capability input nor returns result relations. C7B must not redo any of those concerns.

## C7B implementation map

Create only these use cases and their colocated specs:

- `viewpro-app/apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.ts`
- `viewpro-app/apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts`
- `viewpro-app/apps/api/src/property-proposals/use-cases/get-property-proposal-review.use-case.ts`
- `viewpro-app/apps/api/src/property-proposals/use-cases/get-property-proposal-review.use-case.spec.ts`

Both classes follow the existing seller-use-case DI shape: `@Injectable()`, constructor injection of `@Inject(PROPERTY_PROPOSALS_REPOSITORY) private readonly propertyProposalsRepository: PropertyProposalsRepository`, and `execute(tenant: TenantContext, currentUser: CurrentUser, ...)`. No Prisma injection, transaction, or repository-port change is legitimate.

### Authority boundary

Use an explicit local reviewer-role mapping against `TenantRole.MANAGER` and `TenantRole.PRINCIPAL_MANAGER`; require both that mapping and `tenant.permissions.includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)`. Do not derive authority from `Object.values(PERMISSIONS)`, general manager permissions, or a role/capability supplied by input. `AGENT`, a malformed/unsupported role, a manager role missing review capability, and a forged agent capability all fail before either repository method is called.

The failure convention is `new ForbiddenException('Insufficient permissions')` (403, no new proposal error code), matching existing authorization outcomes. The transport `PermissionGuard` later provides permission-before-lookup; C7B repeats the direct-invocation use-case boundary without adding controller behavior.

Self-review is deliberately not rejected in these read use cases: the approved contract allows managers to inspect all tenant proposals, while durable `proposal.proposedByUserId === currentUser.id` self-review prohibition applies to future approve/reject commands. U9 must enforce it using that durable identity and `PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN` (403), never role history or request data. C7B must not preemptively add that command rule.

### List and detail behavior

`ListPropertyProposalReviewUseCase` accepts only the existing review-filter shape, authorizes, then calls `listForReviewer({ tenantId: tenant.tenantId, filters })`. It must propagate supplied state/history/page/pageSize unchanged; it must not inject a search feature, alter filters, sort items, or locally query. Repository normalization owns default pending state and newest-first order. For the response page metadata, use `normalizeReviewerRead(filters)` solely to return `{ ...pageResult, page, pageSize }`; passing the original filters preserves C7A2's repository normalization and predicate ownership.

`GetPropertyProposalReviewUseCase` authorizes, then calls `findForReviewer({ tenantId: tenant.tenantId, proposalId })` with no list filters. It permits authorized reviewers to inspect every state. `null` becomes exactly:

```ts
new NotFoundException({
  errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND',
  message: 'Property proposal not found',
})
```

This is identical for missing and cross-tenant IDs. No role failure may be turned into 404, and no lookup occurs before a direct authority failure.

C7B's result mapping is limited to the page envelope and direct proposal read result already returned by C7A2. `mapPropertyProposalSnapshot` is a normalization helper for immutable submission rounds, not a reviewer response mapper. The current `PropertyProposal` read shape has no loaded `sourceEngagement`/`canonicalEngagementId`; C7B must not invent, load, or expose one. U10B exclusively owns fresh viewer-specific canonical-result visibility and response mapping, so no approval-result link can leak here.

## Behavioral RED plan

Do not count a missing import, zero collected test, or absent class as RED. If a compiling seam is needed, add only a minimal importable skeleton first, then run collected assertions against its wrong behavior and record that concrete assertion failure as RED.

1. List role matrix: manager and principal manager with explicit review permission each call the repository with the trusted tenant; AGENT, unsupported role, manager-without-capability, and forged-capability agent throw the exact forbidden outcome and perform no reads or writes.
2. List contract: `{}` reaches the repository unchanged, returns page 1/pageSize 20, preserves the repository's pending/newest item order, and explicit state/history/page/pageSize values are propagated while returned page metadata is normalized. Mutating a default/filter/page mapping or reordering items must fail.
3. Detail contract: both manager roles receive tenant-scoped all-state detail; missing and cross-tenant `null` map to the exact coded 404; unauthorized contexts perform no lookup. Mutating the tenant ID or null mapping must fail.
4. Mutation safety: every list/detail and denied-path fake exposes `createDraft`, `updateForSeller`, and `submitForSeller`; assert they remain uncalled. Also assert neither result gains a canonical-result ID from an absent relation.
5. Triangulate explicit-role and capability conjunction separately by removing the principal role and by accepting role-only/capability-only access; each matrix must fail before restoring GREEN.

The focused C7B command is exactly:

```sh
pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts src/property-proposals/use-cases/get-property-proposal-review.use-case.spec.ts
pnpm --filter @viewpro/api typecheck
```

No command was run during this exploration.

## Scope, wiring, and budget

C7B legitimately excludes module wiring. `PropertyProposalsModule` currently registers only the seller use cases; C7A1/C7A2 and the C7B task manifest explicitly exclude module wiring, and U13 owns the first module/App mount with transport. Therefore do not alter `property-proposals.module.ts` or `app.module.ts` in C7B.

Also exclude repository/filter changes; writes/approve/reject; U10B result visibility; U14 search/DTO; controller/routes/BFF/UI; schema/migration; and C8+.

Apply allowlist is the four source/test paths above, plus `openspec/changes/seller-property-proposals/tasks.md` only to check C7B's two completed rows and `openspec/changes/seller-property-proposals/apply-progress.md` only for factual TDD/command/cleanup/line evidence. This exploration artifact is the required phase artifact; no other planning companion needs alteration absent a proven correction.

The task plan's C7B source/test forecast is 130–160 lines. Including this approximately 90-line exploration artifact and an estimated 30–45 lines of mandatory task/progress closure yields an honest total forecast of **250–295 changed lines**, within the 400-line review budget. No `size:exception` is needed.

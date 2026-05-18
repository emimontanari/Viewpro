# Stage 11 Tenant Isolation Hardening Design

Stage 11 Slice 3 proves and documents ViewPro's multi-tenant boundaries before the pilot. The slice is test/docs-first: add a tenant isolation matrix, strengthen high-risk e2e gaps, and make only minimal bug fixes if a new test exposes a real leak.

## Decision

Use targeted e2e hardening plus an explicit isolation matrix. Do not refactor tenant isolation broadly unless a failing test proves a concrete problem.

## Why this slice exists

ViewPro is multi-tenant. A single cross-tenant leak is more damaging than a missing UI polish detail. Existing guards and repositories already look consistent, so this slice should prove the boundaries rather than churn working code.

## Scope

### In scope

- Document a tenant isolation matrix for route families.
- Add focused e2e tests for known high-risk gaps:
  - cross-tenant movement creation;
  - document approve/reject across tenants;
  - analytics reports without cross-tenant contamination;
  - owner endpoints ignoring misleading `x-tenant-id`;
  - admin endpoints still using only `VIEWPRO_ADMIN` even with arbitrary `x-tenant-id`.
- Preserve existing status semantics:
  - unauthenticated: `401`;
  - invalid/missing tenant context or permission denial: `403` where guard-level;
  - inaccessible resource: `404` where resource-level to avoid existence leaks.
- Apply minimal code fixes only if tests reveal a leak.
- Update roadmap and relevant docs.

### Out of scope

- Large tenant guard/repository refactors.
- Row-level security/Postgres RLS.
- Admin capability changes.
- Owner membership model changes.
- Frontend changes.
- New seeded browser tests.

## Isolation matrix

| Route family | Authority source | Tenant header | Expected denial shape | Invariant |
|--------------|------------------|---------------|------------------------|-----------|
| Internal tenant workspace | `TenantMembershipGuard` + permissions | Required | `401` unauth, `403` guard/permission denial, `404` inaccessible resource | Tenant A cannot list/read/mutate Tenant B records. |
| Property engagements | Tenant membership + role/agent assignment | Required | `404` for cross-tenant or unassigned resource reads | Agents only see assigned engagements; managers see tenant records only. |
| Movements | Tenant-visible engagement first, then movement by tenant | Required | `404` for cross-tenant engagement/movement | Movement creation/listing cannot cross tenant boundaries. |
| Documents internal | Tenant membership + manager/requesting seller rules | Required | `404` for cross-tenant or peer seller resources | Document actions stay within tenant and allowed role/requester. |
| Analytics | Tenant membership + manager permission | Required | `403` permission denial; tenant-scoped reports | Reports never aggregate another tenant's events. |
| Owner portal | `PropertyAssetOwner(accessStatus: ACTIVE)` | Ignored | `404` for non-owner/revoked/inaccessible resources | Owner access is ownership-based, not tenant membership based. |
| Admin ViewPro | `User.globalRole === VIEWPRO_ADMIN` | Ignored | `403` for non-global admin | Tenant roles/headers never grant global admin access. |

## Testing strategy

Use existing API e2e patterns and keep the slice targeted.

Minimum tests:

- `movements.e2e-spec.ts`: user from Tenant A cannot create a movement for Tenant B engagement.
- `documents.e2e-spec.ts`: Tenant A manager/seller cannot approve/reject Tenant B document request.
- `analytics.e2e-spec.ts`: Tenant A report excludes Tenant B events.
- `owner-portal.e2e-spec.ts` or owner documents e2e: owner access ignores misleading `x-tenant-id` from another tenant.
- `admin.e2e-spec.ts`: global admin still succeeds with arbitrary `x-tenant-id`; non-admin tenant member still fails with arbitrary `x-tenant-id`.

## Error handling

Do not normalize every denial to one status. The project currently separates guard-level denial from resource-level non-disclosure:

- guard-level missing/invalid tenant or permission: `403`;
- resource exists but is inaccessible/cross-tenant: `404`;
- owner access denied/revoked: `404`;
- admin role missing: `403`.

This distinction should be documented and tested.

## Verification

```bash
pnpm --filter @viewpro/api test -- test/movements.e2e-spec.ts test/documents.e2e-spec.ts test/analytics.e2e-spec.ts test/owner-portal.e2e-spec.ts test/admin.e2e-spec.ts
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

## Acceptance criteria

- Tenant isolation matrix exists and matches implemented behavior.
- High-risk cross-tenant e2e gaps are covered.
- New tests pass without broad refactor.
- Any discovered leak gets a minimal fix and test.
- Admin and owner boundaries remain separate from tenant membership.

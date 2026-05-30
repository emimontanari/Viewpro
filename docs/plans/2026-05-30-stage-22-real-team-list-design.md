# Stage 22.1 — Real Team List Design

Stage 22 starts the **Equipo real** roadmap stage by removing the fake user-management path from `app-new` and replacing it with a real, tenant-scoped, read-only team list.

## Decision

Build a dedicated read-only team-members contract backed by `TenantMembership + User`.

| Option | Decision | Why |
|---|---|---|
| Dedicated team endpoint | Accepted | Correct domain boundary for team management and a clean base for invites/role changes/deactivation. |
| Reuse assignable agents endpoint | Rejected | Too product-assignment-specific and missing membership/status metadata. |
| Only remove mocks | Rejected | Safer but does not advance Stage 22 enough; the app still needs a real team surface. |

## Scope

This slice delivers a real **read-only** team list.

Included:

- Backend `GET /team/members` endpoint.
- Tenant-scoped response mapped from `TenantMembership` joined to `User`.
- App-new BFF `GET /api/users` proxying the real backend endpoint.
- Frontend users service no longer importing `fakeUsers`.
- `/dashboard/users` shows the real team list instead of a pending/demo state.
- Fake create/update/delete user paths are disabled or made honest until later Stage 22 slices.

Not included:

- Inviting managers/sellers.
- Internal invite acceptance or credential setup.
- Role changes.
- User or membership deactivation.
- Trial user-limit enforcement.
- Phone/contact fields.
- Reworking property-agent assignment behavior.

## Backend design

Add a `TeamModule` with a protected read endpoint:

```txt
GET /team/members
```

The endpoint must:

- require authentication;
- require tenant context via the existing tenant guard/header flow;
- require `TEAM_VIEW` permission;
- only return memberships for the active tenant;
- never expose global users outside the tenant.

Response item shape:

```ts
type TeamMemberResponse = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  userStatus: 'ACTIVE' | 'SUSPENDED';
  role: 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT';
  createdAt: string;
  updatedAt: string;
};
```

Response envelope:

```ts
type TeamMembersResponse = {
  items: TeamMemberResponse[];
};
```

The use case should reuse `MembershipsRepository.findManyByTenantId(tenant.tenantId)` as the source of truth.

## Frontend/BFF design

Keep the existing app-new route path for compatibility:

```txt
GET /api/users
```

but change it from mock data to a BFF proxy to the API team endpoint.

`POST /api/users`, `PUT /api/users/:id`, and `DELETE /api/users/:id` should not mutate fake in-memory users. For this slice, they should return an honest unsupported response such as `405 Method Not Allowed` or `501 Not Implemented`, depending on the existing BFF conventions.

`features/users/api/service.ts` should fetch `/api/users` instead of importing `fakeUsers` directly.

## UI design

`/dashboard/users` should become an honest read-only team page.

The page should show:

- team member name;
- email;
- tenant role;
- user status;
- membership creation date if useful and low-cost;
- empty state when no team members are returned.

The page should not show create/edit/delete actions yet. If a CTA is present, it should be disabled or copy-only with text explaining that invitations are the next Stage 22 slice.

The existing template-style fake table can be adapted only if it remains small. Prefer a simpler domain-specific read-only list/table over preserving fake fields like `phone`, numeric IDs, or free-form role/status strings.

## Data flow

```txt
/dashboard/users
  -> features/users/api/service.getUsers()
  -> app-new GET /api/users
  -> API GET /team/members
  -> TenantMembership + User
```

The BFF must forward the authenticated session and selected tenant the same way existing app-new BFF routes do.

## Security and permissions

- The backend endpoint is the permission boundary.
- The BFF must not synthesize or filter cross-tenant data.
- Missing tenant context should fail closed.
- Suspended users/tenants follow the existing tenant guard behavior.
- The response should not include password hashes, global roles beyond what is needed, or unrelated tenant memberships.

## Testing strategy

Backend:

- Unit test `ListTeamMembersUseCase` mapping from memberships to response items.
- Controller/e2e coverage for authenticated tenant-scoped access if existing API test patterns support it.
- Verify role/status values are preserved.

Frontend/BFF:

- BFF route test for `GET /api/users` proxying to `/team/members`.
- BFF route tests for unsupported mutation methods if changed.
- Users service test verifying it calls `/api/users` and no longer imports `fakeUsers`.
- Users page/component test rendering real team rows and no fake CRUD controls.

Regression checks:

- Product assignable-agents tests remain green.
- App-new typecheck/build remain green.

## Review strategy

Expected review size is medium. Keep the PR focused:

- one backend read endpoint;
- one BFF conversion;
- one read-only UI surface;
- no invite/manage behavior.

If the UI adaptation grows because of the existing fake table/actions, replace it with a smaller read-only team table/list instead of carrying the template CRUD forward.

## Acceptance criteria

- `/dashboard/users` no longer displays pending/demo/fake user management.
- `GET /api/users` no longer returns `fakeUsers` data.
- The team list is backed by real tenant memberships and users.
- Team data is tenant-scoped and permission-guarded in the API.
- Unsupported create/update/delete paths no longer mutate in-memory fake users.
- Tests cover backend mapping and app-new BFF/service/UI behavior.

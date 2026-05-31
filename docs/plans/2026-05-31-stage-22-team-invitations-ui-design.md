# Stage 22.3 — Team Invitation UI/BFF Design

Stage 22.3 connects the Stage 22.2 backend invitation API to app-new so a manager can create a team invitation from the real team page and copy the manual link. This is a focused UI/BFF slice: it does **not** add public acceptance, email delivery, pending invitation listing, resend/revoke UI, role changes, deactivation, or user limits.

## Decision

Build a **minimal invitation dialog with an explicit team-invitations BFF route**.

| Option | Decision | Why |
|---|---|---|
| Dialog + create/copy link | Accepted | Gives managers the first visible invitation workflow while staying within the backend contract that already exists. |
| Full team management page with pending invitations | Rejected for this slice | Requires list/resend/revoke invitation UI and likely backend listing endpoints; too large for one safe PR. |
| Only BFF/service without UI | Rejected | Does not solve the user-facing need to invite someone from Equipo. |
| Reuse `POST /api/users` | Rejected | Creating an invitation is not creating a user; an explicit route avoids semantic debt. |

## Scope

Included:

- Add an app-new BFF endpoint:
  - `POST /api/team/invitations`
  - proxies to backend `/team/invitations` through `bffFetch`.
- Add frontend invitation types and service function:
  - `createTeamInvitation(payload)`.
- Add a client invitation UI on `/dashboard/users`:
  - button: `Invitar miembro`.
  - dialog fields: email and role.
  - allowed roles: `MANAGER` and `AGENT` only.
  - submit creates the backend invitation.
  - success attempts to copy `invitationUrl` to clipboard.
  - manual fallback displays the link if clipboard copy fails or the user wants to copy again.
- Keep the current server-side team member fetch and list rendering.
- Use Spanish UI copy for the new user-facing flow.
- Add targeted tests for BFF, service, and client component behavior.

Not included:

- Public validation/acceptance page for team invitations.
- Password setup or auth/session creation from team invite.
- Email delivery.
- Pending invitation list.
- Resend/revoke UI.
- Bulk Excel/CSV import for inviting many employees at once.
- Role changes for active members.
- Member deactivation/suspension.
- Trial/user-limit enforcement.
- Closing issues, deleting branches, or opening PRs without explicit user confirmation.

## Route and API shape

### App-new BFF

```txt
POST /api/team/invitations
```

Implementation path:

```txt
viewpro-app/apps/app-new/src/app/api/team/invitations/route.ts
```

Behavior:

- Read the incoming request body as text.
- Proxy to backend `/team/invitations` with `method: 'POST'`.
- Set `content-type: application/json`.
- Use `bffFetch` so cookies and selected tenant headers are forwarded consistently.
- Return `proxyJsonResponse(response)` on success.
- Return `proxyBffErrorResponse(error, 'No se pudo crear la invitación.')` on transport/config errors.

This intentionally avoids overloading `POST /api/users`, which currently communicates that user mutations are unsupported.

### Frontend service

Add types in:

```txt
viewpro-app/apps/app-new/src/features/users/api/types.ts
```

```ts
export type TeamInvitationRole = Extract<TenantRole, 'MANAGER' | 'AGENT'>;

export type CreateTeamInvitationPayload = {
  email: string;
  role: TeamInvitationRole;
};

export type TeamInvitationLinkResponse = {
  invitationId: string;
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING';
  expiresAt: string;
  invitationUrl: string;
};
```

Add service in:

```txt
viewpro-app/apps/app-new/src/features/users/api/service.ts
```

```ts
const TEAM_INVITATIONS_API_PATH = '/api/team/invitations';

export async function createTeamInvitation(
  data: CreateTeamInvitationPayload
): Promise<TeamInvitationLinkResponse> {
  const response = await apiFetch(TEAM_INVITATIONS_API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });

  return parseJsonResponse<TeamInvitationLinkResponse>(response);
}
```

Keep existing `createUser`, `updateUser`, and `deleteUser` unsupported. Invitation creation gets a dedicated function.

## UI design

Keep the page entrypoint as a server component:

```txt
viewpro-app/apps/app-new/src/app/dashboard/users/page.tsx
```

It should still fetch real team members server-side and pass them into a client wrapper.

Add a client component:

```txt
viewpro-app/apps/app-new/src/features/users/components/team-management-section.tsx
```

Responsibilities:

- Render the card header action button `Invitar miembro`.
- Own invitation dialog open/close state.
- Own mutation state and the returned manual link.
- Render the existing `TeamMembersList` for members.

Add a dialog component:

```txt
viewpro-app/apps/app-new/src/features/users/components/invite-team-member-dialog.tsx
```

Responsibilities:

- Email input.
- Role select with Spanish labels:
  - `Agente` → `AGENT`
  - `Manager` → `MANAGER`
- Basic client-side validation:
  - non-empty email.
  - browser-like email shape check.
  - allowed role only.
- Submit button disabled while pending.
- On success:
  - store the response.
  - attempt `navigator.clipboard.writeText(response.invitationUrl)`.
  - show success toast if copy works.
  - show fallback toast and visible link if clipboard fails.
- Always display the generated link after success so the user can copy manually.
- Provide an `Invitar otra persona` action that clears the form/result.

The generated link can be visible inside the dialog instead of adding a persistent page-level invitation list. That matches the current backend capability and avoids implying pending invitation management.

## Data flow

```txt
/dashboard/users server component
  └─ getUsers(... forwarded cookies + x-tenant-id)
  └─ TeamManagementSection client component
       ├─ TeamMembersList members={team.items}
       └─ InviteTeamMemberDialog
            └─ createTeamInvitation(payload)
                 └─ POST /api/team/invitations app-new BFF
                      └─ bffFetch('/team/invitations') backend API
```

`/team/members` does not show pending invitations. After creating an invitation, the team member list does not need to refresh because no active membership has been created yet.

## Error handling

- BFF transport/config errors return Spanish fallback message.
- Backend validation/authorization/conflict messages are forwarded through existing proxy helpers where possible.
- Service `parseJsonResponse` surfaces backend `message` strings or arrays.
- UI shows `toast.error(error.message || 'No se pudo crear la invitación.')`.
- Clipboard failure does **not** make the invitation fail; it shows the manual link fallback.

## Tests

Add/change targeted tests:

- `viewpro-app/apps/app-new/src/app/api/team/invitations/route.test.ts`
  - proxies `POST` body to `/team/invitations`.
  - sends `content-type: application/json`.
  - returns backend JSON on success.
  - maps BFF errors to fallback message.
- `viewpro-app/apps/app-new/src/features/users/api/service.test.ts`
  - `createTeamInvitation` posts to `/api/team/invitations`.
  - sends JSON body and content-type.
  - parses invitation response.
  - existing unsupported user mutation tests remain valid.
- `viewpro-app/apps/app-new/src/features/users/components/team-management-section.test.tsx`
  - renders current members.
  - opens the invite dialog.
  - validates required/invalid email.
  - submits email + role.
  - copies returned `invitationUrl` on success.
  - shows the manual link if clipboard copy fails.
  - shows API error feedback.

Validation commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/team/invitations/route.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/users/components/team-management-section.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

## Future follow-up: bulk import

Bulk Excel/CSV invitation import is a likely real-estate workflow: inmobiliarias may already keep employee lists in spreadsheets and need a faster path than inviting one person at a time.

Keep it out of this branch. A safe future slice should first define:

- accepted file formats (`.xlsx` vs `.csv`);
- required columns (`email`, `role`, optional name fields);
- preview/validation before sending;
- duplicate and existing-member handling;
- per-row errors;
- rate limits and batch size;
- whether the backend creates invitations synchronously or via a background job.

Do not add a dead or disabled `Importar Excel` button in Stage 22.3 because it would advertise a workflow that does not exist yet.

## Risks

- The backend requires `TEAM_MANAGE`; users without that permission will receive an authorization error. Permission-aware hiding can be added later when the frontend exposes permissions.
- No pending invitations list exists yet, so the generated link must be copied immediately from the success dialog.
- Browser clipboard may fail outside secure contexts; visible manual link fallback is required.
- This slice adds visible product UI, so keep copy Spanish and avoid template English labels in new components.

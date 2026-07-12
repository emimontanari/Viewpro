# Stage 22.5 — Pending Team Invitations Design

Stage 22.5 adds operational management for pending team invitations. Stage 22.2 created secure backend invitation management, Stage 22.3 added the invitation creation UI, and Stage 22.4 added public acceptance. Managers now need a way to see pending invitations, regenerate a copyable link, and revoke invites that should no longer be usable.

## Decision

Build a **pending invitations list with safe resend/revoke actions** on the existing `/dashboard/users` team management page.

| Option | Decision | Why |
|---|---|---|
| Dedicated pending list + actions | Accepted | Keeps the API small, preserves token security, and fits the current `/dashboard/users` management UI. |
| Aggregate members + invitations endpoint | Rejected | Duplicates the existing `/team/members` contract and creates a larger API shift for little benefit. |
| Persist retrievable tokens for direct copy | Rejected | Current security posture stores only `tokenHash`; storing raw/recoverable invitation secrets would require a separate security design. |

Approved product choices:

- `GET /team/invitations` requires `TEAM_MANAGE`.
- The list shows only pending, unexpired invitations.
- “Copy link” is implemented as **regenerate and copy**: it rotates the invitation token, invalidates the previous pending link, and copies the fresh URL.

## Scope

Included:

- Backend management endpoint:
  - `GET /api/team/invitations`
- Pending invitation response shape with safe metadata only.
- App-new BFF support:
  - `GET /api/team/invitations`
  - `POST /api/team/invitations/[id]/resend`
  - `POST /api/team/invitations/[id]/revoke`
- App-new service/types for pending invitations and actions.
- Dashboard `/dashboard/users` pending invitations section.
- UI actions:
  - regenerate and copy link;
  - revoke invitation.
- Targeted backend, BFF, service, and component tests.

Not included:

- Email delivery.
- Showing expired invitations.
- Invitation history/audit log.
- Search/filter/pagination for pending invitations.
- Bulk CSV/Excel import.
- Persisting original invitation URLs.
- Member role changes or deactivation.
- Generic notifications beyond existing toast patterns.
- Opening PRs or cleanup without explicit confirmation.

## Backend design

Extend the existing guarded team management API, not the public acceptance controller.

```txt
GET /api/team/invitations
AuthGuard + TenantMembershipGuard + PermissionGuard
RequirePermissions(TEAM_MANAGE)
```

The use case should also call `ensureTeamManagePermission(tenant)` as defense in depth, matching create/resend/revoke patterns.

### Response contract

```ts
type PendingTeamInvitationsResponse = {
  items: Array<{
    invitationId: string;
    email: string;
    role: 'MANAGER' | 'AGENT';
    status: 'PENDING';
    expiresAt: string;
    createdAt: string;
    invitedByUserId: string;
  }>;
};
```

Rules:

- Tenant-scoped by selected tenant.
- Only `PENDING` invitations.
- Exclude expired invitations with `expiresAt > now`.
- Require `acceptedAt = null` and `revokedAt = null`.
- Sort newest first by `createdAt DESC`.
- Never return `tokenHash`, raw token, or `invitationUrl`.

### Repository method

Add a safe list method to `TeamInvitationsRepository`:

```ts
listPendingInvitations(input: {
  tenantId: string;
  now?: Date;
}): Promise<TeamInvitation[]>;
```

The Prisma implementation should use the existing indexes:

```ts
where: {
  tenantId,
  status: TeamInvitationStatus.PENDING,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
}
```

No schema migration is required.

## App-new design

### Data flow

```txt
/dashboard/users server component
  ├─ getUsers(...tenant headers)
  ├─ getTeamInvitations(...tenant headers)
  └─ TeamManagementSection
       ├─ TeamMembersList
       ├─ InviteTeamMemberDialog
       └─ PendingTeamInvitationsList
            ├─ Regenerar y copiar link
            └─ Revocar
```

`/dashboard/users` should load members and pending invitations in parallel because the requests are independent once headers are known.

### BFF routes

Extend the current route:

```txt
GET  /api/team/invitations
POST /api/team/invitations
```

Add action routes:

```txt
POST /api/team/invitations/[id]/resend
POST /api/team/invitations/[id]/revoke
```

All use `bffFetch` so cookies and selected tenant headers are forwarded consistently.

### UI behavior

Add a second card/section under the existing members card:

- title: `Invitaciones pendientes`
- description: `Links activos que todavía no fueron aceptados.`
- empty state: `No hay invitaciones pendientes.`

Each item shows:

- email;
- role label (`Agente`, `Manager`);
- expiration date;
- actions:
  - `Regenerar y copiar link`;
  - `Revocar`.

### Regenerate/copy behavior

Clicking `Regenerar y copiar link`:

1. calls `resendTeamInvitation(invitationId)`;
2. receives a fresh `invitationUrl` and new `invitationId`;
3. attempts `navigator.clipboard.writeText(invitationUrl)`;
4. shows success toast if copied;
5. shows warning toast and visible fallback link if clipboard fails;
6. refreshes pending invitations because the original row is revoked and the new row replaces it.

The label must make token rotation clear enough to avoid implying the old link remains valid.

### Revoke behavior

Clicking `Revocar`:

1. calls `revokeTeamInvitation(invitationId)`;
2. removes the invitation from the visible pending list;
3. shows a success toast;
4. shows an error toast if the API rejects the action.

A browser confirm or lightweight confirmation UI can be used if existing project patterns support it. If no existing confirm pattern is available, keep the first slice simple with a direct revoke button plus clear label and test coverage.

## Error handling

Backend:

- Missing auth/tenant/permission follows existing guards.
- Use-case missing `TEAM_MANAGE` returns `ForbiddenException`.
- List returns `{ items: [] }` when there are no pending unexpired invitations.
- Resend/revoke retain existing stale/expired/not-found behavior.

App-new:

- BFF transport/config errors return Spanish fallback messages.
- Service `parseJsonResponse` surfaces backend messages.
- UI mutation errors show toast errors.
- Clipboard failure does not mean resend failed; the fresh link remains visible as fallback.

## Security considerations

- Pending list exposes invited emails, so it requires `TEAM_MANAGE`.
- List response must not contain `tokenHash`, raw token, or `invitationUrl`.
- Original links cannot be reconstructed from stored hashes; copy requires rotating to a fresh link.
- Resend/revoke remain tenant-scoped through repository predicates.
- Expired invitations are hidden to avoid encouraging stale management paths in this slice.

## Testing strategy

Backend:

- Repository list returns only pending, unexpired, current-tenant invitations.
- Repository list excludes expired, revoked, accepted, and other-tenant invitations.
- Use case requires `TEAM_MANAGE` and maps safe response shape.
- E2E `GET /api/team/invitations` requires auth, tenant context, and `TEAM_MANAGE`.
- E2E response excludes token hash and invitation URL.

App-new:

- BFF `GET /api/team/invitations` proxies correctly.
- BFF resend/revoke action routes proxy correctly.
- Service methods call the right same-origin paths.
- Dashboard section renders pending invitations.
- Regenerate/copy calls resend, copies fresh URL, refreshes visible list, and shows fallback on clipboard failure.
- Revoke removes the item and shows success/error feedback.
- Existing invite dialog behavior remains green.

## Acceptance criteria

- Managers with `TEAM_MANAGE` can see pending, unexpired invitations for the selected tenant.
- Users without `TEAM_MANAGE` cannot list pending invitation emails.
- Pending list never exposes token hashes, raw tokens, or original invitation URLs.
- Managers can regenerate and copy a fresh invitation link from the pending list.
- Regenerating invalidates the previous pending invitation and refreshes the visible list.
- Managers can revoke pending invitations from the dashboard.
- Existing create invitation, public acceptance, resend, and revoke behavior remains intact.

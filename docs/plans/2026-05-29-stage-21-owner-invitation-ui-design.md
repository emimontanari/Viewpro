# Stage 21.3 Owner Invitation Acceptance UI Design

This slice adds the public app-new page that lets an invited property owner accept an invitation token, create credentials, and land in the owner portal. The backend validation and acceptance endpoints already exist from Stage 21.2.

## Decision

Build **one complete public acceptance page** using existing app-new UI primitives and styling patterns.

| Area | Decision |
|------|----------|
| Route | Add `/owner-invitations/[token]` as a public App Router page. |
| API | Add app-new client functions for `GET /owner-invitations/:token` and `POST /owner-invitations/:token/accept`. |
| Form | Prefill first/last name from the invitation and keep both fields editable. |
| Redirect | On success, refresh session state and redirect to `/owner`. |
| Styling | Reuse existing project components/styles only; do not create new shared UI primitives or a new visual system. |
| Copy | Use the existing app-new Spanish UX tone for user-facing copy. |

## User flow

1. The invited owner opens `/owner-invitations/<raw-token>`.
2. The page validates the token through the backend.
3. If valid, the page shows:
   - property summary;
   - invited email;
   - editable first and last name fields;
   - password field.
4. The owner submits the form.
5. The backend creates the owner account, activates the property-owner link, and sets auth cookies.
6. The app refreshes client/session state and redirects the owner to `/owner`.

## App structure

Add a focused owner-invitations feature without changing protected-route middleware:

```txt
viewpro-app/apps/app-new/src/app/owner-invitations/[token]/page.tsx
viewpro-app/apps/app-new/src/features/owner-invitations/api/service.ts
viewpro-app/apps/app-new/src/features/owner-invitations/api/types.ts
viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx
```

The route stays public because `src/proxy.ts` currently protects only `/dashboard` and `/owner`. Do not add this route to protected matchers.

## UI composition rules

Reuse the same components and conventions already used by auth and owner pages:

- existing `Card`, `Alert`, button, input/form components, and utility classes;
- existing form hooks/patterns from `features/auth/components/sign-up-view.tsx`;
- existing API client conventions from `src/lib/api-client.ts`;
- existing session/redirect behavior from auth views.

Do not add new design-system components, global CSS, custom card variants, or one-off styling utilities. New code may create route/feature components for this flow, but those components must compose the existing UI building blocks.

## States and error handling

| Backend case | UI behavior |
|--------------|-------------|
| Valid token | Show invitation details and account-creation form. |
| `404` unknown token | Show a non-retryable invalid-link state. |
| `410` expired | Show an expired-link state and ask the user to request a new invitation. |
| `410` revoked | Show an unavailable-link state. |
| `410` already accepted | Show an already-accepted state with a sign-in link. |
| `409` existing user | Explain that the email is already registered and link to sign-in. |
| `400` validation | Show field-level or form-level validation feedback. |
| Network/server failure | Show a retryable generic error state. |

Keep token details out of visible messages, logs, query params, and redirects.

## Security and SEO

- Do not expose token hashes or internal invitation state.
- Keep the raw token only in the route param used for API calls.
- Do not append the token to follow-up redirects.
- Add page metadata with `robots: { index: false, follow: false }`.
- Always redirect accepted owners to `/owner`, not `/dashboard`.

## Testing plan

Add focused app-new tests for:

- service functions call the expected endpoints and parse the response shape;
- valid invitation renders property/email summary and prefilled editable names;
- successful submit calls accept and redirects to `/owner`;
- invalid, expired, already accepted, and existing-user states render the right user guidance;
- client-side validation prevents weak password/blank first name submission.

Targeted commands:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter lint
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

Backend shape reference if needed:

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

## Out of scope

- Real email delivery.
- Invitation resend/revoke UI.
- Existing-user invitation acceptance.
- Backend behavior changes unless implementation reveals a blocking bug.
- New shared UI components or a new design language.

## Next step

Write the implementation plan, then implement this as the next Stage 21 review slice targeting `develop`.

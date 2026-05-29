# Stage 21.4 Owner Invitation Manual Delivery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let tenant users generate, rotate, copy, and manually send owner invitation links for `INVITED` property owners.

**Architecture:** Add a tenant-authenticated property-engagement endpoint that rotates pending invitations and returns a one-time `invitationUrl`. Add an app-new BFF/service/UI action that calls the endpoint, copies the returned URL to the clipboard, and shows a temporary manual-copy fallback if clipboard access fails.

**Tech Stack:** NestJS, Prisma, `@nestjs/config`, existing ViewPro auth/tenant/permission guards, Next.js App Router BFF routes, React, TanStack Query mutations, existing shadcn-style UI primitives, Vitest, Testing Library.

---

## Non-negotiables

- Raw invitation tokens are never stored in the database.
- Raw tokens are never returned from list/detail endpoints.
- Raw token or full invitation URL is returned only once, from the explicit manual generation endpoint.
- Clicking `Copiar invitación` always rotates: previous pending links for that owner become invalid.
- The UI must reuse the existing property owner card, buttons, badges, toast, and local styling patterns.
- Do not add real email delivery in this slice.
- Do not implement existing-user invitation acceptance in this slice.

## Task 1: Add API app public URL config

**Files:**
- Modify: `viewpro-app/apps/api/.env.example`
- Modify: `viewpro-app/apps/api/src/config/env.schema.ts`
- Modify: `viewpro-app/apps/api/src/config/app.config.ts`
- Test: `viewpro-app/apps/api/src/config/app.config.spec.ts` if config tests exist or create it if useful

**Step 1: Add/extend config tests**

Search first:

```bash
find viewpro-app/apps/api/src/config -name '*spec.ts' -o -name '*test.ts'
```

If no config test exists, create `viewpro-app/apps/api/src/config/app.config.spec.ts` with focused tests for URL trimming/defaults.

Target behavior:

```ts
import { describe, expect, it } from 'vitest';
import { getAppPublicUrl } from './app.config';

describe('getAppPublicUrl', () => {
  it('defaults to the local app origin outside production', () => {
    expect(getAppPublicUrl(undefined, 'development')).toBe('http://localhost:3000');
  });

  it('trims trailing slashes', () => {
    expect(getAppPublicUrl('https://app.viewpro.test/', 'production')).toBe(
      'https://app.viewpro.test'
    );
  });

  it('requires an explicit app origin in production', () => {
    expect(() => getAppPublicUrl(undefined, 'production')).toThrow('APP_PUBLIC_URL');
  });
});
```

**Step 2: Run config test and verify RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run src/config/app.config.spec.ts
```

Expected: FAIL because `getAppPublicUrl` does not exist.

**Step 3: Implement config helper**

In `app.config.ts`, add:

```ts
export function getAppPublicUrl(appPublicUrl: string | undefined, nodeEnv: NodeEnv) {
  const rawUrl = appPublicUrl ?? (nodeEnv === 'production' ? undefined : 'http://localhost:3000');

  if (!rawUrl) {
    throw new Error('APP_PUBLIC_URL must be configured in production');
  }

  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
}
```

Then include it in `appConfig`:

```ts
publicUrl: getAppPublicUrl(process.env.APP_PUBLIC_URL, nodeEnv),
```

**Step 4: Update env schema**

In `env.schema.ts`, add optional string validation:

```ts
@IsOptional()
@IsString()
APP_PUBLIC_URL?: string;
```

**Step 5: Update `.env.example`**

Add near `API_PUBLIC_URL`:

```txt
APP_PUBLIC_URL=http://localhost:3000
```

**Step 6: Run config validation**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run src/config/app.config.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add viewpro-app/apps/api/.env.example viewpro-app/apps/api/src/config/env.schema.ts viewpro-app/apps/api/src/config/app.config.ts viewpro-app/apps/api/src/config/app.config.spec.ts
git commit -m "config(api): add app public url"
```

## Task 2: Add backend manual invitation link endpoint

**Files:**
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/create-owner-invitation-link.use-case.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/responses/owner-invitation-link.response.ts`
- Test: `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`

**Step 1: Write failing e2e tests**

Add tests near the existing owner-link invitation tests in `property-engagements.e2e-spec.ts`.

Test cases:

1. `creates and returns a manual invitation link for an invited owner`:
   - register manager;
   - create engagement;
   - link an unregistered owner email;
   - call `POST /api/property-engagements/:id/owners/:ownerId/invitation-link`;
   - expect `201`;
   - expect body contains `invitationId`, `propertyAssetOwnerId`, `email`, `expiresAt`, `invitationUrl`;
   - expect body does **not** contain `tokenHash`;
   - extract token from returned URL path;
   - call `GET /api/owner-invitations/:token` and expect `200`.

2. `revokes older pending invitations when rotating`:
   - generate link twice for the same invited owner;
   - validate first token returns `410`;
   - validate second token returns `200`;
   - assert DB has one `PENDING` and at least one `REVOKED` invitation for the owner link.

3. `rejects active owners`:
   - register an owner user first;
   - link that owner email so access is `ACTIVE`;
   - call invitation-link endpoint;
   - expect `409`.

4. `does not create links for cross-tenant engagements or unrelated owners`:
   - tenant A calls endpoint against tenant B engagement or owner;
   - expect `404` using existing tenant visibility behavior.

Use a helper to extract token without logging it:

```ts
function extractInvitationToken(invitationUrl: string) {
  const url = new URL(invitationUrl);
  const token = url.pathname.split('/').pop();

  if (!token) {
    throw new Error('Missing invitation token in generated URL');
  }

  return decodeURIComponent(token);
}
```

**Step 2: Run e2e and verify RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts
```

Expected: FAIL because the route does not exist.

**Step 3: Add repository contract types**

In `property-engagements.repository.ts`, add:

```ts
export type CreateOwnerInvitationLinkResult =
  | {
      status: 'created';
      invitation: {
        id: string;
        propertyAssetOwnerId: string;
        email: string;
        token: string;
        expiresAt: Date;
      };
    }
  | { status: 'ownerNotFound' }
  | { status: 'ownerNotInvited'; accessStatus: PropertyAssetOwnerAccessStatus };
```

Add repository method:

```ts
createOwnerInvitationLink(input: {
  propertyAssetId: string;
  ownerId: string;
}): Promise<CreateOwnerInvitationLinkResult>;
```

**Step 4: Implement Prisma transaction**

In `prisma-property-engagements.repository.ts`:

- find `PropertyAssetOwner` by `id` and `propertyAssetId`;
- if missing, return `ownerNotFound`;
- if `accessStatus !== INVITED`, return `ownerNotInvited`;
- generate token using `createOwnerInvitationToken()`;
- `updateMany` existing pending invitations for that owner link:

```ts
await tx.ownerInvitation.updateMany({
  where: {
    propertyAssetOwnerId: owner.id,
    status: OwnerInvitationStatus.PENDING,
  },
  data: {
    status: OwnerInvitationStatus.REVOKED,
    revokedAt: now,
  },
});
```

- create the new invitation with `tokenHash` and `expiresAt`;
- return raw `token` only from this transaction result.

**Step 5: Add response mapper**

Create `owner-invitation-link.response.ts`:

```ts
export type OwnerInvitationLinkResponse = {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
};

export function mapOwnerInvitationLinkResponse(input: {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: Date;
  invitationUrl: string;
}): OwnerInvitationLinkResponse {
  return {
    invitationId: input.invitationId,
    propertyAssetOwnerId: input.propertyAssetOwnerId,
    email: input.email,
    expiresAt: input.expiresAt.toISOString(),
    invitationUrl: input.invitationUrl,
  };
}
```

**Step 6: Add use case**

Create `create-owner-invitation-link.use-case.ts`:

- inject `PROPERTY_ENGAGEMENTS_REPOSITORY`;
- inject `ConfigService`;
- enforce `PERMISSIONS.ENGAGEMENTS_CREATE` like `LinkPropertyOwnerUseCase`;
- load engagement via `findByIdForTenant`;
- call repository with `engagement.propertyAssetId` and `ownerId`;
- map repository statuses:
  - engagement missing: `NotFoundException('Property engagement not found')`;
  - owner missing: `NotFoundException('Property owner not found')`;
  - owner not invited: `ConflictException('Owner invitation link can only be generated for invited owners')`;
- build URL with configured public origin:

```ts
const appPublicUrl = this.configService.getOrThrow<string>('app.publicUrl');
const invitationUrl = `${appPublicUrl}/owner-invitations/${encodeURIComponent(invitation.token)}`;
```

- map response without exposing `token` or `tokenHash`.

**Step 7: Wire module and controller**

In `property-engagements.module.ts`, add `CreateOwnerInvitationLinkUseCase` to `propertyEngagementUseCases`.

In `property-engagements.controller.ts`:

- import use case;
- inject it in constructor;
- add route before `:id/agents` is fine:

```ts
@Post(':id/owners/:ownerId/invitation-link')
@RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
createOwnerInvitationLink(
  @CurrentTenant() tenant: TenantContext,
  @CurrentUser() currentUser: CurrentUserContext,
  @Param('id') id: string,
  @Param('ownerId') ownerId: string,
) {
  return this.createOwnerInvitationLinkUseCase.execute(tenant, currentUser, id, ownerId);
}
```

**Step 8: Run backend checks**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
git diff --check
```

Expected: PASS.

**Step 9: Commit**

```bash
git add viewpro-app/apps/api/src/property-engagements viewpro-app/apps/api/test/property-engagements.e2e-spec.ts
git commit -m "feat(owners): generate manual invitation links"
```

## Task 3: Add app-new BFF route and product API client

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/products/api/service.test.ts`

**Step 1: Add service tests first**

Create `service.test.ts` if it does not exist. Stub `fetch` and test only the new function.

Expected service function:

```ts
createProductOwnerInvitationLink(productId: string, ownerId: string)
```

Test assertions:

- calls `/api/products/product-1/owners/owner-link-1/invitation-link`;
- uses `POST`;
- uses `credentials: 'include'` and `cache: 'no-store'` via `apiFetch`;
- returns parsed response.

**Step 2: Run test and verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/service.test.ts
```

Expected: FAIL because function/type/route do not exist.

**Step 3: Add product API type**

In `types.ts`:

```ts
export type ProductOwnerInvitationLinkResponse = {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
};
```

**Step 4: Add service function**

In `service.ts`, import the type and add:

```ts
export async function createProductOwnerInvitationLink(
  productId: string,
  ownerId: string
): Promise<ProductOwnerInvitationLinkResponse> {
  const response = await apiFetch(
    `${PRODUCTS_API_PATH}/${productId}/owners/${ownerId}/invitation-link`,
    { method: 'POST' }
  );

  return parseJsonResponse<ProductOwnerInvitationLinkResponse>(response);
}
```

**Step 5: Add BFF route**

Create route:

```ts
// Temporary BFF adapter: product-named frontend route maps manual owner invitation links
// to ViewPro backend property engagement owner invitations.

import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string; ownerId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id, ownerId } = await params;
    const response = await bffFetch(
      `/property-engagements/${id}/owners/${ownerId}/invitation-link`,
      { method: 'POST' }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo generar el link de invitación.');
  }
}
```

**Step 6: Run app-new checks**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/api/service.ts src/features/products/api/types.ts src/features/products/api/service.test.ts 'src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts'
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/api/service.ts src/features/products/api/types.ts src/features/products/api/service.test.ts 'src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts'
git diff --check
```

Expected: PASS.

**Step 7: Commit**

```bash
git add viewpro-app/apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts viewpro-app/apps/app-new/src/features/products/api/service.ts viewpro-app/apps/app-new/src/features/products/api/types.ts viewpro-app/apps/app-new/src/features/products/api/service.test.ts
git commit -m "feat(app-new): add owner invitation link client"
```

## Task 4: Add property owner card copy action

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-card.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-owner-card.test.tsx`

**Step 1: Write component tests first**

Create tests around `PropertyOwnerCard`.

Test cases:

1. renders `Copiar invitación` for `INVITED` owners;
2. does not render copy action for `ACTIVE` owners;
3. calls `onCopyInvitationLink(owner)` when clicked;
4. disables the clicked owner action while `copyingInvitationOwnerId` matches;
5. renders a temporary manual-copy fallback link when provided.

Use an owner factory:

```ts
const invitedOwner: PropertyLinkedOwner = {
  id: 'owner-link-1',
  userId: null,
  email: 'owner@example.com',
  firstName: null,
  lastName: null,
  ownerFirstName: 'Ana',
  ownerLastName: 'Owner',
  isPrimary: true,
  accessStatus: 'INVITED',
};
```

**Step 2: Run test and verify RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx
```

Expected: FAIL because props/UI are missing.

**Step 3: Update component props**

Add props:

```ts
type ManualInvitationFallback = {
  ownerId: string;
  invitationUrl: string;
};

type PropertyOwnerCardProps = {
  // existing props...
  copyingInvitationOwnerId?: string | null;
  manualInvitationFallback?: ManualInvitationFallback | null;
  onCopyInvitationLink?: (owner: PropertyLinkedOwner) => void;
};
```

For each owner with `accessStatus === 'INVITED'`, render:

```tsx
<Button
  type='button'
  size='sm'
  variant='outline'
  disabled={copyingInvitationOwnerId === owner.id}
  onClick={() => onCopyInvitationLink?.(owner)}
>
  Copiar invitación
</Button>
```

If fallback matches owner:

```tsx
<div className='rounded-md border border-dashed bg-muted/40 p-2 text-xs'>
  <p className='font-medium'>Copiá este link manualmente:</p>
  <a href={manualInvitationFallback.invitationUrl} className='break-all underline'>
    {manualInvitationFallback.invitationUrl}
  </a>
</div>
```

Use existing classes only; do not add global CSS or new shared components.

**Step 4: Run component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/property-owner-card.tsx viewpro-app/apps/app-new/src/features/products/components/property-owner-card.test.tsx
git commit -m "feat(app-new): show copy invitation action"
```

## Task 5: Wire product form mutation and clipboard behavior

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- Possibly modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-card.test.tsx` if prop behavior changes

**Step 1: Add mutation and state in `product-form.tsx`**

Import:

```ts
createProductOwnerInvitationLink,
```

Add state:

```ts
const [copyingInvitationOwnerId, setCopyingInvitationOwnerId] = useState<string | null>(null);
const [manualInvitationFallback, setManualInvitationFallback] = useState<{
  ownerId: string;
  invitationUrl: string;
} | null>(null);
```

Add handler:

```ts
async function handleCopyInvitationLink(owner: PropertyLinkedOwner) {
  if (isArchived || copyingInvitationOwnerId) {
    return;
  }

  setCopyingInvitationOwnerId(owner.id);
  setManualInvitationFallback(null);

  try {
    const response = await createProductOwnerInvitationLink(propertyEngagement.id, owner.id);

    try {
      await navigator.clipboard.writeText(response.invitationUrl);
      toast.success('Link de invitación copiado. Los links anteriores ya no funcionan.');
    } catch {
      setManualInvitationFallback({ ownerId: owner.id, invitationUrl: response.invitationUrl });
      toast.warning('No pudimos copiar automáticamente. Copiá el link manualmente.');
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'No se pudo generar el link de invitación.');
  } finally {
    setCopyingInvitationOwnerId(null);
  }
}
```

Pass props to `PropertyOwnerCard`:

```tsx
copyingInvitationOwnerId={copyingInvitationOwnerId}
manualInvitationFallback={manualInvitationFallback}
onCopyInvitationLink={handleCopyInvitationLink}
```

**Step 2: Run targeted component tests**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/components/property-owner-card.test.tsx
```

Expected: PASS.

If existing product form tests are introduced later, add direct tests there. For this slice, keep behavior covered at card/service level and rely on build/typecheck for wiring.

**Step 3: Run app-new TypeScript/build subset**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/service.test.ts src/features/products/components/property-owner-card.test.tsx
git diff --check
```

Expected: PASS.

**Step 4: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
git commit -m "feat(app-new): copy owner invitation links"
```

## Task 6: Update user-facing copy and docs

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/link-property-owner-dialog.tsx`
- Modify: `viewpro-app/README.md`

**Step 1: Update link-owner dialog copy**

Replace the outdated message:

```txt
La invitación por email se activará en una próxima etapa.
```

with copy that matches manual delivery:

```txt
Después vas a poder copiar un link de invitación para enviarlo manualmente.
```

Replace field description:

```txt
No vamos a enviar ningún email todavía; solo quedará vinculado a esta propiedad.
```

with:

```txt
No enviaremos email automático todavía. El link se puede copiar manualmente desde la propiedad.
```

**Step 2: Update README owner invitations section**

Add a short section under owner portal/documents or auth backend:

```md
## Owner invitations

Invited unregistered owners are linked as `INVITED` and receive access through a tokenized URL. Tenant users can manually generate a fresh invitation link from the property owner card; generating a new link revokes older pending links. The raw token is returned once and only `tokenHash` is stored.

Email delivery is still out of scope; links are sent manually for now.
```

**Step 3: Commit**

```bash
git add viewpro-app/apps/app-new/src/features/products/components/link-property-owner-dialog.tsx viewpro-app/README.md
git commit -m "docs(owners): document manual invitation delivery"
```

## Task 7: Full validation and review

**Files:**
- All files changed in this branch.

**Step 1: Backend validation**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 2: Frontend validation**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/products/api/service.test.ts src/features/products/components/property-owner-card.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxlint src/features/products/api/service.ts src/features/products/api/types.ts src/features/products/api/service.test.ts src/features/products/components/property-owner-card.tsx src/features/products/components/property-owner-card.test.tsx src/features/products/components/product-form.tsx src/features/products/components/link-property-owner-dialog.tsx 'src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts'
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec oxfmt --check src/features/products/api/service.ts src/features/products/api/types.ts src/features/products/api/service.test.ts src/features/products/components/property-owner-card.tsx src/features/products/components/property-owner-card.test.tsx src/features/products/components/product-form.tsx src/features/products/components/link-property-owner-dialog.tsx 'src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts'
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

Expected: PASS. Full app-new `lint` may still fail on known pre-existing owner `<img>` lint debt; if unchanged files still cause that, document it in the PR like Stage 21.3.

**Step 3: Global checks**

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors, clean worktree after commits.

**Step 4: LSP diagnostics**

Run LSP diagnostics on changed backend and frontend files:

```txt
viewpro-app/apps/api/src/config/app.config.ts
viewpro-app/apps/api/src/config/env.schema.ts
viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts
viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts
viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts
viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts
viewpro-app/apps/api/src/property-engagements/use-cases/create-owner-invitation-link.use-case.ts
viewpro-app/apps/api/src/property-engagements/responses/owner-invitation-link.response.ts
viewpro-app/apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/route.ts
viewpro-app/apps/app-new/src/features/products/api/service.ts
viewpro-app/apps/app-new/src/features/products/api/types.ts
viewpro-app/apps/app-new/src/features/products/components/property-owner-card.tsx
viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
```

Expected: no diagnostics.

**Step 5: Fresh review**

Ask a fresh reviewer to audit:

- raw token is never stored or exposed outside the explicit response;
- previous pending invitations are revoked on rotation;
- new generated URL validates through the public endpoint;
- cross-tenant and active-owner cases are blocked;
- UI appears only for invited owners;
- no new shared UI primitives or visual system were created;
- known lint debt is documented if full lint still fails on unchanged files.

## Task 8: Issue and PR

**Step 1: Inspect review workload**

```bash
git diff --stat develop..HEAD
git diff --shortstat develop..HEAD
```

If changed lines exceed 400, ask whether to use one size-exception PR or split backend/frontend PRs. Recommended if the diff is focused: one size-exception PR, because backend endpoint and UI action are one workflow.

**Step 2: Create approved issue**

Title:

```txt
feat(owners): add manual owner invitation links
```

Labels:

```txt
enhancement
status:approved
```

Body should mention:

- authenticated tenant users can generate/copy invitation links;
- generation rotates pending links;
- raw tokens are returned once and not stored;
- email delivery remains out of scope.

**Step 3: Push and open PR**

```bash
git push -u origin feat/stage-21-owner-invitation-manual-link
gh pr create --base develop --head feat/stage-21-owner-invitation-manual-link --title "feat(owners): add manual owner invitation links" --body-file <body-file>
gh pr edit <pr-number> --add-label type:feature
```

PR body must include:

- `Closes #<issue-number>`;
- exactly one type checkbox: New feature;
- summary;
- changed files table;
- test plan;
- security notes;
- known existing lint debt if still relevant;
- out-of-scope list.

## Review budget forecast

This slice touches backend, BFF, frontend UI, tests, and docs. Expect review workload risk above 400 lines. Keep the implementation narrowly scoped and be ready to request a single `size-exception` or split backend/frontend if the diff grows beyond the planned files.

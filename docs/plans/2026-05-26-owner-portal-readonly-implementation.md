# Owner Portal Read-only Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated read-only owner portal in `app-new` where an authenticated property owner can see their active properties and visible movement timeline.

**Architecture:** Use a separate `/owner` route tree with a minimal owner layout, avoiding the tenant-based dashboard shell. Add `app-new` BFF adapters that proxy existing backend `/api/owner/*` endpoints, then build a small owner feature module with typed services, TanStack Query options, and read-only UI components. Update demo seed with one active owner user and extend seeded Playwright smoke to validate the owner flow.

**Tech Stack:** Next.js App Router, React, TanStack Query, TypeScript, Vitest, Testing Library, Playwright, NestJS existing owner APIs, Prisma demo seed.

---

## Constraints

- Active UI work is in `viewpro-app/apps/app-new`.
- Do not add backend endpoints or schema unless a blocking gap appears.
- Do not put owner UX under `/dashboard`.
- Do not require tenant membership for owner routes.
- Do not include document upload or document request UI in this slice.
- Keep seeded E2E sequential.
- Keep review workload small; if document UI becomes tempting, defer it.

## Existing Contracts

Backend owner endpoints already exist:

```txt
GET /api/owner/properties
GET /api/owner/properties/:propertyAssetId
GET /api/owner/properties/:propertyAssetId/engagements
GET /api/owner/engagements/:engagementId/timeline
```

Owner access is active link based:

```ts
owners: { some: { userId, accessStatus: 'ACTIVE' } }
```

Current demo seed owner links are `INVITED` and not linked to a real user, so seeded smoke needs one active owner user.

---

### Task 1: Protect `/owner` and allow safe owner redirects

**Files:**
- Modify: `viewpro-app/apps/app-new/src/proxy.ts`
- Modify: `viewpro-app/apps/app-new/src/features/auth/components/sign-in-view.tsx`
- Test: `viewpro-app/apps/app-new/src/features/auth/components/sign-in-view.test.ts`

**Step 1: Write failing redirect tests**

Add tests:

```ts
it('keeps safe owner redirect URLs', () => {
  expect(getSafeSignInRedirect('/owner/properties/property-1')).toBe(
    '/owner/properties/property-1'
  );
});

it('rejects unsafe owner redirects', () => {
  expect(getSafeSignInRedirect('/owner/../dashboard')).toBe('/dashboard');
  expect(getSafeSignInRedirect('https://evil.example/owner')).toBe('/dashboard');
});
```

**Step 2: Run failing test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/auth/components/sign-in-view.test.ts
```

Expected: owner redirect test fails because only `/dashboard` is accepted.

**Step 3: Implement safe owner redirects**

In `sign-in-view.tsx`, replace the dashboard-only checks with a helper:

```ts
function isSafeAppRedirectPath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/owner' ||
    pathname.startsWith('/owner/')
  );
}
```

Use it for both raw path and parsed URL pathname checks.

**Step 4: Protect `/owner` in proxy**

In `proxy.ts`, replace:

```ts
if (!req.nextUrl.pathname.startsWith('/dashboard')) {
  return NextResponse.next();
}
```

with:

```ts
if (!isProtectedAppPath(req.nextUrl.pathname)) {
  return NextResponse.next();
}
```

and add:

```ts
function isProtectedAppPath(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/owner' || pathname.startsWith('/owner/');
}
```

**Step 5: Run test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/auth/components/sign-in-view.test.ts
```

Expected: PASS.

---

### Task 2: Add a deterministic active owner to the demo seed

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add owner seed constants**

Near `DEMO_USERS`, add:

```js
const DEMO_OWNER_EMAIL = 'propietario.demo@viewpro.local';
const DEMO_OWNER_USER = {
  email: DEMO_OWNER_EMAIL,
  firstName: 'Propietario',
  lastName: 'Demo',
};
const DEMO_AUTH_USERS = [...DEMO_USERS, DEMO_OWNER_USER];
```

Change:

```js
const DEMO_USER_EMAILS = DEMO_USERS.map((user) => user.email);
```

to:

```js
const DEMO_USER_EMAILS = DEMO_AUTH_USERS.map((user) => user.email);
```

**Step 2: Create owner user without tenant membership**

Change `createDemoUsers` loop to iterate `DEMO_AUTH_USERS`, not `DEMO_USERS`:

```js
for (const user of DEMO_AUTH_USERS) {
  // existing upsert
  users.set(user.email, { ...created, role: user.role });
}
```

Keep `createDemoTenant` using `DEMO_USERS`, so the owner does not receive a tenant membership.

**Step 3: Link first property to active owner**

In `createDemoProperties`, add:

```js
const demoOwner = users.get(DEMO_OWNER_EMAIL);
```

Before creating `propertyAssetOwner`, derive owner fields:

```js
const isDemoOwnerProperty = index === 0;
const linkedOwnerEmail = isDemoOwnerProperty ? DEMO_OWNER_EMAIL : `propietario-${index + 1}@viewpro.local`;
```

Then set `propertyAssetOwner.create.data` fields:

```js
ownerEmail: linkedOwnerEmail,
ownerFirstName: isDemoOwnerProperty ? demoOwner.firstName : 'Propietario',
ownerLastName: isDemoOwnerProperty ? demoOwner.lastName : `Demo ${index + 1}`,
userId: isDemoOwnerProperty ? demoOwner.id : undefined,
accessStatus: isDemoOwnerProperty
  ? PropertyAssetOwnerAccessStatus.ACTIVE
  : PropertyAssetOwnerAccessStatus.INVITED,
```

**Step 4: Run demo seed**

```bash
cd viewpro-app
pnpm --filter @viewpro/api demo:seed
```

Expected output still reports 20 properties and seeded demo data.

**Step 5: Verify DB owner visibility**

Run a one-off Prisma check:

```bash
cd viewpro-app/apps/api
node --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const owner = await prisma.user.findUnique({
  where: { email: 'propietario.demo@viewpro.local' },
  include: { memberships: true, ownedProperties: true },
});
console.log({
  email: owner?.email,
  memberships: owner?.memberships.length,
  ownerLinks: owner?.ownedProperties.length,
  accessStatus: owner?.ownedProperties[0]?.accessStatus,
});
await prisma.$disconnect();
NODE
```

Expected:

```txt
memberships: 0
ownerLinks: 1
accessStatus: ACTIVE
```

---

### Task 3: Add owner BFF route adapters

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/owner/properties/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/properties/[id]/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/properties/[id]/engagements/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/timeline/route.ts`
- Test: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/timeline/route.test.ts`

**Step 1: Write failing timeline BFF test**

Use the existing BFF test pattern from `src/app/api/dashboard/summary/route.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from '@/lib/bff-api';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

describe('owner timeline BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards timeline pagination to the backend owner endpoint', async () => {
    await GET(
      new NextRequest('http://localhost/api/owner/engagements/engagement-1/timeline?page=1&pageSize=10&order=desc'),
      { params: Promise.resolve({ id: 'engagement-1' }) }
    );

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/owner/engagements/engagement-1/timeline?page=1&pageSize=10&order=desc'
    );
  });
});
```

**Step 2: Run failing test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/app/api/owner/engagements/[id]/timeline/route.test.ts
```

Expected: fails because route does not exist.

**Step 3: Implement route handlers**

Use simple adapters:

```ts
import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const query = request.nextUrl.search;
    const response = await bffFetch(`/owner/engagements/${id}/timeline${query}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo cargar el seguimiento del propietario.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El portal propietario tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
```

For other routes:

```ts
GET /api/owner/properties                  -> bffFetch('/owner/properties')
GET /api/owner/properties/[id]             -> bffFetch(`/owner/properties/${id}`)
GET /api/owner/properties/[id]/engagements -> bffFetch(`/owner/properties/${id}/engagements`)
```

**Step 4: Run BFF test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/app/api/owner/engagements/[id]/timeline/route.test.ts
```

Expected: PASS.

---

### Task 4: Add owner API service, query keys, and types

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/owner/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/owner/api/queries.ts`

**Step 1: Create response types**

In `types.ts`:

```ts
export type OwnerProperty = {
  id: string;
  title: string;
  addressLine: string;
  city: string;
  province: string;
  propertyType: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerEngagement = {
  id: string;
  tenant: { id: string; name: string };
  operationType: string;
  status: string;
  publishedPriceCents: number;
  currency: string;
  agents: Array<{ userId: string; firstName: string; email: string }>;
  createdAt: string;
  updatedAt: string;
};

export type OwnerMovement = {
  id: string;
  propertyEngagementId: string;
  type: string;
  observation: string;
  nextStep: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  source: string;
  interestCount: number | null;
  visitCount: number | null;
  offerAmountCents: number | null;
  interestLevel: string | null;
  createdBy: { id: string; email: string; firstName: string };
  createdAt: string;
};

export type OwnerPropertiesResponse = { items: OwnerProperty[] };
export type OwnerEngagementsResponse = { items: OwnerEngagement[] };
export type OwnerTimelineResponse = {
  engagement: OwnerEngagement;
  items: OwnerMovement[];
  total: number;
  page: number;
  pageSize: number;
};
```

**Step 2: Create service functions**

In `service.ts`, follow `features/activity/api/service.ts`:

```ts
export async function getOwnerProperties(): Promise<OwnerPropertiesResponse>;
export async function getOwnerProperty(id: string): Promise<OwnerProperty>;
export async function getOwnerPropertyEngagements(id: string): Promise<OwnerEngagementsResponse>;
export async function getOwnerEngagementTimeline(id: string, filters?: { page?: number; pageSize?: number; order?: 'asc' | 'desc' }): Promise<OwnerTimelineResponse>;
```

Use same-origin `/api/owner/...`, `credentials: 'include'`, `cache: 'no-store'`, and a 10s timeout message like `El portal propietario tardó demasiado.`

**Step 3: Create query options**

In `queries.ts`:

```ts
export const ownerKeys = {
  all: ['owner'] as const,
  properties: () => [...ownerKeys.all, 'properties'] as const,
  property: (id: string) => [...ownerKeys.properties(), id] as const,
  engagements: (propertyId: string) => [...ownerKeys.property(propertyId), 'engagements'] as const,
  timeline: (engagementId: string, filters: OwnerTimelineFilters) =>
    [...ownerKeys.all, 'engagements', engagementId, 'timeline', filters] as const
};
```

Add `ownerPropertiesOptions`, `ownerPropertyOptions`, `ownerPropertyEngagementsOptions`, and `ownerEngagementTimelineOptions`.

**Step 4: Run typecheck after types are consumed**

Do not run global typecheck yet if no UI imports these files. Run after Task 6.

---

### Task 5: Add minimal owner layout and header

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/owner/layout.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-shell-header.tsx`

**Step 1: Implement layout**

Create `app/owner/layout.tsx`:

```tsx
import { OwnerShellHeader } from '@/features/owner/components/owner-shell-header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal propietario',
  description: 'Seguimiento de propiedades para propietarios',
  robots: { index: false, follow: false }
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-muted/20'>
      <OwnerShellHeader />
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8'>
        {children}
      </main>
    </div>
  );
}
```

**Step 2: Implement owner header**

Use `useSession`, `getUserDisplayName`, and `signOut`. Do not reuse `UserNav` because it contains dashboard-only links.

Expected behavior:

- brand link to `/owner`;
- label `Portal propietario`;
- user email/name;
- `Salir` button signs out and routes to `/auth/sign-in`.

**Step 3: Keep it responsive**

On mobile, stack the brand/label and user action cleanly. Avoid sidebar.

---

### Task 6: Build owner home page

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/owner/page.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`
- Test: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`

**Step 1: Write component test**

Mock API query data through TanStack Query or mock the service module. Assert:

- heading `Portal propietario` or `Tus propiedades`;
- seeded-like property title appears;
- `Nueva propiedad` does not appear;
- no agency selector appears when the owner has one inmobiliaria;
- agency selector appears and filters cards when the owner has multiple inmobiliarias;
- property card links to `/owner/properties/property-1`.

Example assertion:

```ts
expect(screen.getByRole('heading', { name: /Tus propiedades/i })).toBeInTheDocument();
expect(screen.getByText('Casa familiar con pileta en Villa Centenario')).toBeInTheDocument();
expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: /Ver seguimiento/i })).toHaveAttribute(
  'href',
  '/owner/properties/property-1'
);
```

**Step 2: Run failing test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/owner/components/owner-home.test.tsx
```

Expected: fails because component does not exist.

**Step 3: Implement page and component**

`app/owner/page.tsx`:

```tsx
import { OwnerHome } from '@/features/owner/components/owner-home';

export default function OwnerPage() {
  return <OwnerHome />;
}
```

`OwnerHome` should:

- use `useQuery(ownerPropertiesOptions())`;
- use `useQueries` with `ownerPropertyEngagementsOptions(property.id)` to derive the inmobiliarias that invited/linked each property;
- show loading skeleton;
- show error state;
- show empty state for no active owner access;
- render property cards with location and type;
- hide the agency selector for one-inmobiliaria owners;
- show an agency selector and filter property cards when multiple inmobiliarias exist;
- link each card to `/owner/properties/${property.id}`.

**Step 4: Run test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/owner/components/owner-home.test.tsx
```

Expected: PASS.

---

### Task 7: Build owner property detail and timeline

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/owner/properties/[propertyId]/page.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx`
- Test: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`

**Step 1: Write component test**

Mock property, engagement, and timeline responses. Assert:

- property title/location appear;
- agency/tenant name appears;
- assigned agent appears;
- movement observation appears;
- `Nueva propiedad`, `Editar`, and manager-only actions do not appear.

Example:

```ts
expect(screen.getByRole('heading', { name: /Casa familiar con pileta/i })).toBeInTheDocument();
expect(screen.getByText('ViewPro Demo Inmobiliaria')).toBeInTheDocument();
expect(screen.getByText(/Sofía/i)).toBeInTheDocument();
expect(screen.getByText(/Ingresó una consulta calificada/i)).toBeInTheDocument();
expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
expect(screen.queryByText('Editar')).not.toBeInTheDocument();
```

**Step 2: Run failing test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/owner/components/owner-property-detail.test.tsx
```

Expected: fails because detail components do not exist.

**Step 3: Implement route page**

```tsx
type PageProps = { params: Promise<{ propertyId: string }> };

export default async function OwnerPropertyPage({ params }: PageProps) {
  const { propertyId } = await params;
  return <OwnerPropertyDetail propertyId={propertyId} />;
}
```

**Step 4: Implement detail component**

Use queries:

- `ownerPropertyOptions(propertyId)`;
- `ownerPropertyEngagementsOptions(propertyId)`;
- one timeline query per engagement with `{ page: 1, pageSize: 10, order: 'desc' }`.

If multiple engagements exist, render each engagement card with its own timeline.

**Step 5: Implement labels**

Add local formatters in owner components for:

- operation type (`SALE`, `RENT`) if needed;
- status values;
- money cents/currency;
- date display.

Keep them local unless already available in a shared utility. Do not import mutation-heavy product form code.

**Step 6: Run test**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/owner/components/owner-property-detail.test.tsx
```

Expected: PASS.

---

### Task 8: Extend seeded smoke for owner portal

**Files:**
- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Step 1: Add constants**

```ts
const OWNER_EMAIL = 'propietario.demo@viewpro.local';
const OWNER_VISIBLE_PROPERTY_TITLE = 'Casa familiar con pileta en Villa Centenario';
```

**Step 2: Add smoke test**

```ts
test('demo owner can read the owner portal follow-up', async ({ page }) => {
  await signIn(page, OWNER_EMAIL, '/owner');

  await expect(page.getByRole('heading', { name: /Tus propiedades/i })).toBeVisible();
  await expect(page.getByText(OWNER_VISIBLE_PROPERTY_TITLE)).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver seguimiento/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);

  await page.getByRole('link', { name: /Ver seguimiento/i }).first().click();
  await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+$/i);
  await expect(page.getByRole('heading', { name: OWNER_VISIBLE_PROPERTY_TITLE })).toBeVisible();
  await expect(page.getByText(/Ingresó una consulta calificada|Se concretó una visita|Oferta/i).first()).toBeVisible();
});
```

If current `signIn` helper always waits for `/dashboard`, change it to accept an expected path:

```ts
async function signIn(page: Page, email: string, redirectPath = '/dashboard') {
  await page.goto(`/auth/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`);
  // fill credentials
  await page.waitForURL(`**${redirectPath}`);
}
```

Keep existing manager/seller smoke behavior by using the default `/dashboard`.

**Step 3: Run seeded smoke**

```bash
cd viewpro-app
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Expected: manager, seller, and owner seeded smoke pass.

---

### Task 9: Validate and review

**Files:**
- All touched files.

**Step 1: Run focused app-new tests**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- \
  src/features/auth/components/sign-in-view.test.ts \
  src/app/api/owner/engagements/[id]/timeline/route.test.ts \
  src/features/owner/components/owner-home.test.tsx \
  src/features/owner/components/owner-property-detail.test.tsx
```

Expected: PASS.

**Step 2: Run full app-new tests**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test
```

Expected: PASS.

**Step 3: Run typecheck**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 4: Run seeded smoke**

```bash
cd viewpro-app
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Expected: PASS.

**Step 5: Run diff checks**

```bash
cd ..
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files changed.

**Step 6: Fresh review**

Run a fresh reviewer before commit/PR. Ask it to focus on:

- owner route auth/redirect safety;
- no tenant membership coupling;
- BFF path correctness;
- seed reset safety;
- owner-only UX not exposing internal actions;
- seeded smoke reliability.

---

## Commit Plan

Commit implementation as one reviewable unit unless fresh review finds a necessary split:

```bash
git add docs/plans/2026-05-26-owner-portal-readonly-implementation.md \
  viewpro-app/apps/api/scripts/seed-demo.mjs \
  viewpro-app/apps/app-new/src/proxy.ts \
  viewpro-app/apps/app-new/src/features/auth/components/sign-in-view.tsx \
  viewpro-app/apps/app-new/src/features/auth/components/sign-in-view.test.ts \
  viewpro-app/apps/app-new/src/app/api/owner \
  viewpro-app/apps/app-new/src/app/owner \
  viewpro-app/apps/app-new/src/features/owner \
  viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts

git commit -m "feat(app-new): add owner readonly portal"
```

Then push and open a PR against `develop`.

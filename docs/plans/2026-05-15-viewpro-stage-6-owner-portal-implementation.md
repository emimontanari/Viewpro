# ViewPro Stage 6 Owner Portal Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build backend-only owner portal access and read-only owner APIs for properties, engagements, and movement timelines.

**Architecture:** Add `PropertyAssetOwner` as a separate owner access model, then implement owner portal repositories, use cases, response mappers, controller endpoints, and e2e tests. Owner APIs use `AuthGuard` only and authorize through property ownership records, not `TenantMembershipGuard` or `x-tenant-id`.

**Tech Stack:** NestJS 11, Prisma 6.19.2, PostgreSQL, TypeScript, existing auth cookies/JWT, Stage 4 property engagements, Stage 5 movements, Vitest + Supertest e2e.

---

## Non-negotiables

- Do not implement UI.
- Do not implement invitation email flow.
- Do not implement owner self-registration.
- Do not implement documents.
- Do not require `x-tenant-id` on owner endpoints.
- Do not use `TenantMembershipGuard` for owner endpoints.
- Do not expose tenant-internal data or other owners.
- Unauthorized owner access must return `404`, not `403`, for property/engagement resources.
- Do not commit unless explicitly authorized.

## Verification commands

Run from `viewpro-app/`:

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

---

## Task 1: Add owner access Prisma model

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: Prisma migration under `viewpro-app/apps/api/prisma/migrations/`

**Step 1: Add enum**

Add near property enums:

```prisma
enum PropertyAssetOwnerAccessStatus {
  INVITED
  ACTIVE
  REVOKED
}
```

**Step 2: Add model**

Add after `PropertyAsset` or near property models:

```prisma
model PropertyAssetOwner {
  id              String                         @id @default(uuid())
  propertyAssetId String
  userId          String
  isPrimary       Boolean                        @default(false)
  accessStatus    PropertyAssetOwnerAccessStatus @default(INVITED)
  createdAt       DateTime                       @default(now())
  updatedAt       DateTime                       @updatedAt

  propertyAsset PropertyAsset @relation(fields: [propertyAssetId], references: [id], onDelete: Cascade)
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([propertyAssetId, userId])
  @@index([userId, accessStatus])
  @@index([propertyAssetId])
  @@map("property_asset_owners")
}
```

**Step 3: Add relation fields**

Update `User`:

```prisma
ownedPropertyAssets PropertyAssetOwner[]
```

Update `PropertyAsset`:

```prisma
owners PropertyAssetOwner[]
```

**Step 4: Create migration**

Run:

```bash
pnpm --filter @viewpro/api exec prisma migrate dev --name add_property_asset_owners
pnpm db:migrate
```

Expected: migration applies and Prisma Client regenerates.

---

## Task 2: Create owner portal module, repository, and mapper

**Files:**
- Create: `viewpro-app/apps/api/src/owner-portal/owner-portal.module.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/responses/owner-property.response.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/responses/owner-engagement.response.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Repository contract**

Repository must expose:

```ts
export const OWNER_PORTAL_REPOSITORY = Symbol('OWNER_PORTAL_REPOSITORY')

export type OwnerPortalRepository = {
  findPropertiesByOwnerUserId(userId: string): Promise<OwnerPropertyRecord[]>
  findPropertyByOwner(input: { userId: string; propertyAssetId: string }): Promise<OwnerPropertyRecord | null>
  findEngagementsForOwnerProperty(input: { userId: string; propertyAssetId: string }): Promise<OwnerEngagementRecord[]>
  findEngagementTimelineForOwner(input: {
    userId: string
    engagementId: string
    page: number
    pageSize: number
    order: 'asc' | 'desc'
  }): Promise<{ engagement: OwnerEngagementRecord | null; items: OwnerMovementRecord[]; total: number }>
}
```

Use Prisma payload types with includes. Keep the exposed response shape in mappers, not repository.

**Step 2: Prisma implementation rules**

- Property queries require owner access:

```ts
owners: { some: { userId, accessStatus: 'ACTIVE' } }
```

- Engagement queries require engagement property asset ownership.
- Timeline queries require movement engagement property ownership.
- Include only what mappers need:
  - property basic fields
  - engagement status/operation/price/currency/tenant name
  - assigned agent safe fields
  - movement safe fields and creator safe fields

**Step 3: Response mappers**

Owner property response must not include owner list.

Owner engagement response may include:

```ts
{
  id,
  tenant: { id, name },
  operationType,
  status,
  publishedPriceCents,
  currency,
  agents: [{ userId, firstName, email }],
  createdAt,
  updatedAt,
}
```

Owner movement response may include movement fields from Stage 5 and safe creator fields.

**Step 4: Register module**

`OwnerPortalModule` provides repository and later use cases. Register in `AppModule`.

**Step 5: Add repository tests**

Create `viewpro-app/apps/api/test/owner-portal.repository.spec.ts` proving:

- active owner sees owned property.
- revoked owner does not see property.
- owner does not see another owner's property.
- owner can fetch engagements for owned property.

Run:

```bash
pnpm --filter @viewpro/api test -- owner-portal.repository.spec.ts
```

Expected: pass.

---

## Task 3: Add owner portal use cases

**Files:**
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/list-owner-properties.use-case.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/get-owner-property.use-case.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/list-owner-property-engagements.use-case.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/get-owner-engagement-timeline.use-case.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/dto/list-owner-timeline.query.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.module.ts`

**Step 1: Use case behavior**

- `ListOwnerPropertiesUseCase`: returns mapped properties for current user.
- `GetOwnerPropertyUseCase`: returns mapped property or throws `NotFoundException('Owner property not found')`.
- `ListOwnerPropertyEngagementsUseCase`: first ensures property access; if not found, throw `NotFoundException('Owner property not found')`; then returns mapped engagements.
- `GetOwnerEngagementTimelineUseCase`: returns mapped engagement/timeline or throws `NotFoundException('Owner engagement not found')`.

**Step 2: Query DTO**

`list-owner-timeline.query.ts`:

```ts
import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListOwnerTimelineQuery {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc'
}
```

**Step 3: Add unit tests**

Create `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` proving:

- list maps owner properties.
- get missing property throws 404.
- list engagements checks property access first.
- timeline missing engagement throws 404.

Run:

```bash
pnpm --filter @viewpro/api test -- owner-portal.use-cases.spec.ts
```

Expected: pass.

---

## Task 4: Add owner portal controller and e2e tests

**Files:**
- Create: `viewpro-app/apps/api/src/owner-portal/owner-portal.controller.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.module.ts`
- Create: `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts`
- Modify e2e cleanup in existing specs if needed.

**Step 1: Controller**

Use `AuthGuard` only:

```ts
@Controller('owner')
@UseGuards(AuthGuard)
export class OwnerPortalController {
  @Get('properties')
  listProperties(@CurrentUser() user: CurrentUserContext) {}

  @Get('properties/:propertyAssetId')
  getProperty(@CurrentUser() user: CurrentUserContext, @Param('propertyAssetId') propertyAssetId: string) {}

  @Get('properties/:propertyAssetId/engagements')
  listEngagements(@CurrentUser() user: CurrentUserContext, @Param('propertyAssetId') propertyAssetId: string) {}

  @Get('engagements/:engagementId/timeline')
  getTimeline(@CurrentUser() user: CurrentUserContext, @Param('engagementId') engagementId: string, @Query() query: ListOwnerTimelineQuery) {}
}
```

Do not use `TenantMembershipGuard` or `PermissionGuard`.

**Step 2: E2E cases**

Add tests for:

1. Owner lists active owned properties.
2. Owner endpoint does not require `x-tenant-id`.
3. Owner cannot see another owner's property; expect `404`.
4. Revoked owner cannot see property; expect `404`.
5. Owner lists engagements for owned property with sanitized tenant/agent data.
6. Owner reads timeline for owned engagement.
7. Owner cannot read timeline for non-owned engagement; expect `404`.
8. Unauthenticated owner endpoint returns `401`.
9. Responses do not include internal membership or owner-list data.

**Step 3: Run e2e**

```bash
pnpm --filter @viewpro/api test -- owner-portal.e2e-spec.ts
```

Expected: pass.

---

## Task 5: Docs and roadmap update

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

Docs must state:

- Stage 6 backend owner portal supports read-only owner property, engagement, and timeline APIs.
- Owner endpoints use auth cookies but do not require `x-tenant-id`.
- Owners are linked through `PropertyAssetOwner`, not tenant memberships.
- Invitation/self-registration/UI/documents remain out of scope.

---

## Task 6: Final verification

Run:

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Then from repo root:

```bash
git status --short --branch
```

Expected: only intended Stage 6 files are modified/untracked.

---

## Acceptance checklist

- [ ] `PropertyAssetOwner` model and migration exist.
- [ ] Owner endpoints use `AuthGuard` only.
- [ ] Owner endpoints do not require `x-tenant-id`.
- [ ] Owner sees only ACTIVE linked properties.
- [ ] Revoked/other-owner access returns `404`.
- [ ] Owner sees sanitized engagement and timeline data.
- [ ] Owner response does not expose tenant memberships or other owners.
- [ ] Full verification commands pass.

## Review workload forecast

- Estimated changed lines: 800-1,100 including migration, tests, endpoints, and docs.
- 400-line budget risk: High.
- Chained PRs recommended: Yes if this goes through formal review.
- Suggested slices:
  1. Prisma model + repository + mapper + repository tests.
  2. Use cases + unit tests.
  3. Controller + e2e + docs + final verification.

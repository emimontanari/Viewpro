# ViewPro Stage 5 Movements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add backend-only movement creation and timeline retrieval for tenant-scoped property engagements, including optional engagement status transitions.

**Architecture:** Add a Prisma `Movement` model, then implement a NestJS feature with repository, use cases, DTOs, controller, and e2e tests. Movement access reuses Stage 4 engagement visibility rules: managers can access all tenant engagements, while agents can access only assigned engagements.

**Tech Stack:** NestJS 11, Prisma 6.19.2, PostgreSQL, TypeScript, Stage 3 tenant guard chain, Stage 4 property engagement domain, Vitest + Supertest e2e.

---

## Non-negotiables

- Do not implement UI.
- Do not implement owner portal behavior.
- Do not add a separate `property_status_history` table.
- Do not model buyers, renters, or leads.
- Do not add notifications or WhatsApp dispatch.
- Do not trust frontend tenant context beyond `x-tenant-id`.
- Cross-tenant or unassigned engagement access must not leak existence.
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

## Task 1: Add Prisma movement model

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: Prisma migration under `viewpro-app/apps/api/prisma/migrations/`

**Step 1: Add enums**

Add near property engagement enums:

```prisma
enum MovementType {
  GENERAL_UPDATE
  INQUIRY
  VISIT_SCHEDULED
  VISIT_COMPLETED
  OFFER_RECEIVED
  DOCUMENTATION_UPDATE
  STATUS_CHANGE
}

enum MovementSource {
  MANUAL
  SYSTEM
}

enum InterestLevel {
  LOW
  MEDIUM
  HIGH
}
```

**Step 2: Add model**

Add after `PropertyAgent`:

```prisma
model Movement {
  id                   String                    @id @default(uuid())
  tenantId             String
  propertyEngagementId String
  createdByUserId      String
  type                 MovementType
  observation          String
  nextStep             String?
  previousStatus       PropertyEngagementStatus?
  newStatus            PropertyEngagementStatus?
  source               MovementSource            @default(MANUAL)
  interestCount        Int?
  visitCount           Int?
  offerAmountCents     Int?
  interestLevel        InterestLevel?
  createdAt            DateTime                  @default(now())

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  propertyEngagement PropertyEngagement @relation(fields: [propertyEngagementId], references: [id], onDelete: Cascade)
  createdBy          User               @relation(fields: [createdByUserId], references: [id])

  @@index([tenantId, propertyEngagementId, createdAt])
  @@index([createdByUserId])
  @@map("movements")
}
```

**Step 3: Add relation fields**

Update `User`:

```prisma
movements Movement[]
```

Update `Tenant`:

```prisma
movements Movement[]
```

Update `PropertyEngagement`:

```prisma
movements Movement[]
```

**Step 4: Create migration**

Run:

```bash
pnpm --filter @viewpro/api exec prisma migrate dev --name add_movements
```

Then run:

```bash
pnpm db:migrate
```

Expected: migration applies and Prisma Client regenerates.

---

## Task 2: Create movement DTOs and module skeleton

**Files:**
- Create: `viewpro-app/apps/api/src/movements/movements.module.ts`
- Create: `viewpro-app/apps/api/src/movements/dto/create-movement.dto.ts`
- Create: `viewpro-app/apps/api/src/movements/dto/list-movements.query.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Create DTOs**

`create-movement.dto.ts`:

```ts
import { InterestLevel, MovementType, PropertyEngagementStatus } from '@prisma/client'
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateMovementDto {
  @IsEnum(MovementType)
  type!: MovementType

  @IsString()
  @MaxLength(2000)
  observation!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string

  @IsOptional()
  @IsEnum(PropertyEngagementStatus)
  newStatus?: PropertyEngagementStatus

  @IsOptional()
  @IsInt()
  @Min(0)
  interestCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  visitCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  offerAmountCents?: number

  @IsOptional()
  @IsEnum(InterestLevel)
  interestLevel?: InterestLevel
}
```

Implementation note: add `@IsNotEmpty()` to `observation` if the existing validation pipe does not reject empty strings.

`list-movements.query.ts`:

```ts
import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListMovementsQuery {
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

**Step 2: Create module placeholder**

```ts
import { Module } from '@nestjs/common'

@Module({})
export class MovementsModule {}
```

**Step 3: Register module**

Add `MovementsModule` to `AppModule` imports.

**Step 4: Run typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 3: Add repository contract and Prisma implementation

**Files:**
- Create: `viewpro-app/apps/api/src/movements/movements.repository.ts`
- Create: `viewpro-app/apps/api/src/movements/prisma-movements.repository.ts`
- Modify: `viewpro-app/apps/api/src/movements/movements.module.ts`

**Step 1: Create repository contract**

```ts
import type { Movement, Prisma, PropertyEngagementStatus } from '@prisma/client'

export const MOVEMENTS_REPOSITORY = Symbol('MOVEMENTS_REPOSITORY')

export type MovementWithRelations = Prisma.MovementGetPayload<{
  include: { createdBy: true }
}>

export type CreateMovementInput = {
  tenantId: string
  propertyEngagementId: string
  createdByUserId: string
  type: Movement['type']
  observation: string
  nextStep?: string
  newStatus?: PropertyEngagementStatus
  interestCount?: number
  visitCount?: number
  offerAmountCents?: number
  interestLevel?: Movement['interestLevel']
}

export type ListMovementsInput = {
  tenantId: string
  propertyEngagementId: string
  page: number
  pageSize: number
  order: 'asc' | 'desc'
}

export type MovementsRepository = {
  create(input: CreateMovementInput): Promise<MovementWithRelations>
  findMany(input: ListMovementsInput): Promise<{ items: MovementWithRelations[]; total: number }>
}
```

**Step 2: Implement transaction-aware create**

`create` must:

- Load the engagement by `tenantId` + `propertyEngagementId`.
- If no engagement exists, throw `NotFoundException('Property engagement not found')` or return null for use case to map.
- If `newStatus` exists, create movement with `previousStatus` and `newStatus`, then update engagement status in the same Prisma transaction.
- If `newStatus` does not exist, create movement only.

Recommendation: keep repository free of HTTP exceptions; return `null` only when needed, and let use cases throw.

**Step 3: Implement list**

List uses:

```ts
where: { tenantId, propertyEngagementId }
orderBy: { createdAt: order }
skip: (page - 1) * pageSize
take: pageSize
```

Include `createdBy` for response display.

**Step 4: Add focused repository tests**

Create `viewpro-app/apps/api/test/movements.repository.spec.ts` with tests for:

- create movement without status change.
- create movement with status change updates engagement.
- list only movements for tenant engagement.

**Step 5: Run test**

```bash
pnpm --filter @viewpro/api test -- movements.repository.spec.ts
```

Expected: pass.

---

## Task 4: Add access helper/use cases/response mapper

**Files:**
- Create: `viewpro-app/apps/api/src/movements/responses/movement.response.ts`
- Create: `viewpro-app/apps/api/src/movements/use-cases/create-movement.use-case.ts`
- Create: `viewpro-app/apps/api/src/movements/use-cases/list-movements.use-case.ts`
- Modify: `viewpro-app/apps/api/src/movements/movements.module.ts`

**Step 1: Create response mapper**

```ts
export function mapMovement(movement: MovementWithRelations) {
  return {
    id: movement.id,
    tenantId: movement.tenantId,
    propertyEngagementId: movement.propertyEngagementId,
    type: movement.type,
    observation: movement.observation,
    nextStep: movement.nextStep,
    previousStatus: movement.previousStatus,
    newStatus: movement.newStatus,
    source: movement.source,
    interestCount: movement.interestCount,
    visitCount: movement.visitCount,
    offerAmountCents: movement.offerAmountCents,
    interestLevel: movement.interestLevel,
    createdBy: {
      id: movement.createdBy.id,
      email: movement.createdBy.email,
      firstName: movement.createdBy.firstName,
    },
    createdAt: movement.createdAt.toISOString(),
  }
}
```

**Step 2: Enforce engagement visibility**

Inject `PROPERTY_ENGAGEMENTS_REPOSITORY` into use cases.

Before create/list movements:

- Compute `canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)`.
- If user lacks both view-all and view-assigned permissions, throw `ForbiddenException('Insufficient permissions')`.
- Call `findByIdForTenant({ tenantId, engagementId, userId, canViewAll })`.
- If null, throw `NotFoundException('Property engagement not found')`.

For create, also require `tenant.permissions.includes(PERMISSIONS.MOVEMENTS_CREATE)` or throw `ForbiddenException('Insufficient permissions')`.

**Step 3: Add use case tests**

Create `viewpro-app/apps/api/test/movements.use-cases.spec.ts` with tests for:

- manager can create movement.
- agent assigned can create movement.
- unassigned agent gets not found.
- user without movement permission gets forbidden.
- list returns mapped pagination.

**Step 4: Run tests**

```bash
pnpm --filter @viewpro/api test -- movements.use-cases.spec.ts
```

Expected: pass.

---

## Task 5: Add controller and e2e tests

**Files:**
- Create: `viewpro-app/apps/api/src/movements/movements.controller.ts`
- Modify: `viewpro-app/apps/api/src/movements/movements.module.ts`
- Create: `viewpro-app/apps/api/test/movements.e2e-spec.ts`
- Modify existing e2e cleanup files if needed:
  - `viewpro-app/apps/api/test/auth.e2e-spec.ts`
  - `viewpro-app/apps/api/test/tenant-context.e2e-spec.ts`
  - `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`

**Step 1: Controller**

```ts
@Controller('property-engagements/:propertyEngagementId/movements')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class MovementsController {
  @Post()
  @RequirePermissions(PERMISSIONS.MOVEMENTS_CREATE)
  create(...) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  list(...) {}
}
```

Important: list uses `TENANT_VIEW` at guard level and use cases enforce `ENGAGEMENTS_VIEW_ALL` vs `ENGAGEMENTS_VIEW_ASSIGNED`.

**Step 2: E2E tests**

Add tests for:

1. Manager creates movement on tenant engagement.
2. Agent creates movement only on assigned engagement.
3. Agent cannot create movement on unassigned engagement; expect `404`.
4. Movement with `newStatus` updates engagement status.
5. Timeline returns movements for the tenant engagement only.
6. Tenant A cannot read Tenant B movements.
7. Missing `x-tenant-id` fails.
8. Empty observation fails validation.

**Step 3: Run e2e**

```bash
pnpm --filter @viewpro/api test -- movements.e2e-spec.ts
```

Expected: pass.

---

## Task 6: Docs and roadmap update

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

Docs must state:

- Stage 5 backend supports movement creation and timeline retrieval.
- `POST /api/property-engagements/:id/movements` can optionally update engagement status.
- Timeline endpoints require `x-tenant-id`.
- Managers access all tenant engagements; agents only assigned.
- Owner portal display is still future Stage 6.

---

## Task 7: Final verification

**Step 1: Run full verification**

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

**Step 2: Inspect status**

From repo root:

```bash
git status --short --branch
```

Expected: only intended Stage 5 files are modified/untracked.

---

## Acceptance checklist

- [ ] `Movement` model and migration exist.
- [ ] Manager can create/list movement timeline for any tenant engagement.
- [ ] Agent can create/list movement timeline only for assigned engagements.
- [ ] Cross-tenant/unassigned movement access returns `404`.
- [ ] Creating a movement with `newStatus` updates engagement status transactionally.
- [ ] Timeline pagination and order work.
- [ ] Empty observation and invalid enums fail validation.
- [ ] Full verification commands pass.

## Review workload forecast

- Estimated changed lines: 700-1,000 including migration, tests, endpoints, and docs.
- 400-line budget risk: High.
- Chained PRs recommended: Yes if this goes through formal review.
- Suggested slices:
  1. Prisma model + repository + repository tests.
  2. Use cases + mapper + unit tests.
  3. Controller + e2e + docs + full verification.

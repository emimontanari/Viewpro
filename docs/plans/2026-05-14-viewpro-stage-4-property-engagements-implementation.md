# ViewPro Stage 4 Property Engagements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build backend-only property assets and tenant-scoped property engagements with assigned agents, pagination, filters, and e2e tenant isolation.

**Architecture:** Add Prisma domain models, then implement a NestJS feature module using controllers, use cases, repositories, DTOs, and Stage 3 guards. All tenant-scoped queries use `tenantContext.tenantId`; manager roles can access all tenant engagements, agents can access only assigned engagements.

**Tech Stack:** NestJS 11, Prisma 6.19.2, PostgreSQL, TypeScript, cookies `httpOnly`, Stage 3 `x-tenant-id` guard chain, Vitest + Supertest e2e.

---

## Non-negotiables

- Do not implement UI.
- Do not create owner users or `property_asset_owners` yet.
- Do not add movements, documents, or status history.
- Do not ship demo endpoints.
- Do not trust frontend tenant context beyond `x-tenant-id`; backend validates everything.
- Keep tests with the behavior they prove.
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

## Task 1: Add Prisma domain models

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: Prisma migration under `viewpro-app/apps/api/prisma/migrations/`

**Step 1: Add enums**

Add near existing enums:

```prisma
enum PropertyType {
  HOUSE
  APARTMENT
  LAND
  COMMERCIAL
  OTHER
}

enum PropertyOperationType {
  SALE
  RENT
}

enum PropertyEngagementStatus {
  CAPTURE
  DOCUMENTATION_PENDING
  PUBLICATION_PREPARATION
  ACTIVE_PUBLICATION
  INQUIRIES_AND_VISITS
  OFFER_NEGOTIATION
  RESERVATION_STARTED
  FINAL_DOCUMENTATION
  CLOSED
  CANCELLED
}
```

**Step 2: Add models**

Add after `RefreshToken`:

```prisma
model PropertyAsset {
  id              String       @id @default(uuid())
  title           String
  addressLine     String
  city            String
  province        String
  propertyType    PropertyType
  ownerName       String?
  ownerEmail      String?
  createdByUserId String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  createdBy   User                 @relation(fields: [createdByUserId], references: [id])
  engagements PropertyEngagement[]

  @@index([createdByUserId])
  @@index([city, province])
  @@map("property_assets")
}

model PropertyEngagement {
  id                  String                   @id @default(uuid())
  tenantId            String
  propertyAssetId     String
  operationType       PropertyOperationType
  status              PropertyEngagementStatus @default(CAPTURE)
  publishedPriceCents Int?
  currency            String                   @default("ARS")
  createdByUserId     String
  createdAt           DateTime                 @default(now())
  updatedAt           DateTime                 @updatedAt

  tenant        Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  propertyAsset PropertyAsset   @relation(fields: [propertyAssetId], references: [id], onDelete: Cascade)
  createdBy     User            @relation(fields: [createdByUserId], references: [id])
  agents        PropertyAgent[]

  @@index([tenantId, status, createdAt])
  @@index([propertyAssetId])
  @@index([createdByUserId])
  @@map("property_engagements")
}

model PropertyAgent {
  id                   String   @id @default(uuid())
  tenantId             String
  propertyEngagementId String
  agentUserId          String
  assignedByUserId     String
  assignedAt           DateTime @default(now())

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  propertyEngagement PropertyEngagement @relation(fields: [propertyEngagementId], references: [id], onDelete: Cascade)
  agentUser          User               @relation("PropertyAgentUser", fields: [agentUserId], references: [id], onDelete: Cascade)
  assignedByUser     User               @relation("PropertyAgentAssignedBy", fields: [assignedByUserId], references: [id])

  @@unique([propertyEngagementId, agentUserId])
  @@index([tenantId, agentUserId])
  @@index([assignedByUserId])
  @@map("property_agents")
}
```

**Step 3: Add missing User/Tenant relation fields**

Update `User`:

```prisma
createdPropertyAssets       PropertyAsset[]       
createdPropertyEngagements  PropertyEngagement[]
assignedPropertyEngagements PropertyAgent[]        @relation("PropertyAgentUser")
propertyAgentAssignments    PropertyAgent[]        @relation("PropertyAgentAssignedBy")
```

Update `Tenant`:

```prisma
propertyEngagements PropertyEngagement[]
propertyAgents      PropertyAgent[]
```

**Step 4: Run migration**

```bash
pnpm db:migrate
```

Expected: migration generated and applied successfully.

---

## Task 2: Create module skeleton and DTOs

**Files:**
- Create: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/dto/create-property-engagement.dto.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/dto/list-property-engagements.query.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Create DTOs**

`create-property-engagement.dto.ts`:

```ts
import { PropertyOperationType, PropertyType } from '@prisma/client'
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreatePropertyEngagementDto {
  @IsString()
  @MaxLength(120)
  title!: string

  @IsString()
  @MaxLength(180)
  addressLine!: string

  @IsString()
  @MaxLength(80)
  city!: string

  @IsString()
  @MaxLength(80)
  province!: string

  @IsEnum(PropertyType)
  propertyType!: PropertyType

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string

  @IsOptional()
  @IsEmail()
  ownerEmail?: string

  @IsEnum(PropertyOperationType)
  operationType!: PropertyOperationType

  @IsOptional()
  @IsInt()
  @Min(0)
  publishedPriceCents?: number

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string
}
```

`list-property-engagements.query.ts`:

```ts
import { PropertyEngagementStatus, PropertyOperationType } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListPropertyEngagementsQuery {
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
  @IsEnum(PropertyEngagementStatus)
  status?: PropertyEngagementStatus

  @IsOptional()
  @IsEnum(PropertyOperationType)
  operationType?: PropertyOperationType
}
```

**Step 2: Create module placeholder**

`property-engagements.module.ts`:

```ts
import { Module } from '@nestjs/common'

@Module({})
export class PropertyEngagementsModule {}
```

**Step 3: Register module**

Modify `app.module.ts` and add `PropertyEngagementsModule` to imports.

**Step 4: Run typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 3: Add repository contract and Prisma implementation

**Files:**
- Create: `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`

**Step 1: Create repository token and types**

```ts
import type { Prisma, PropertyEngagement, PropertyAgent } from '@prisma/client'

export const PROPERTY_ENGAGEMENTS_REPOSITORY = Symbol('PROPERTY_ENGAGEMENTS_REPOSITORY')

export type PropertyEngagementWithDetails = Prisma.PropertyEngagementGetPayload<{
  include: { propertyAsset: true; agents: { include: { agentUser: true } }; createdBy: true }
}>

export type CreatePropertyEngagementInput = {
  tenantId: string
  createdByUserId: string
  propertyAsset: Prisma.PropertyAssetCreateWithoutEngagementsInput
  engagement: Omit<Prisma.PropertyEngagementUncheckedCreateWithoutPropertyAssetInput, 'tenantId' | 'createdByUserId'>
}

export type ListPropertyEngagementsInput = {
  tenantId: string
  userId: string
  canViewAll: boolean
  page: number
  pageSize: number
  status?: string
  operationType?: string
}

export type PropertyEngagementsRepository = {
  createWithAsset(input: CreatePropertyEngagementInput): Promise<PropertyEngagementWithDetails>
  findMany(input: ListPropertyEngagementsInput): Promise<{ items: PropertyEngagementWithDetails[]; total: number }>
  findByIdForTenant(input: { tenantId: string; engagementId: string; userId: string; canViewAll: boolean }): Promise<PropertyEngagementWithDetails | null>
  assignAgent(input: { tenantId: string; engagementId: string; agentUserId: string; assignedByUserId: string }): Promise<PropertyAgent>
}
```

**Step 2: Implement Prisma queries**

Repository must:

- Use transaction for `createWithAsset`.
- Filter every engagement by `tenantId`.
- For agents with `canViewAll === false`, add `agents: { some: { agentUserId: userId, tenantId } }`.
- Use `skip/take` for pagination.
- Include asset, createdBy, and assigned agents in detail responses.

**Step 3: Register repository provider**

```ts
@Module({
  providers: [{ provide: PROPERTY_ENGAGEMENTS_REPOSITORY, useClass: PrismaPropertyEngagementsRepository }],
  exports: [PROPERTY_ENGAGEMENTS_REPOSITORY],
})
export class PropertyEngagementsModule {}
```

**Step 4: Run typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 4: Add use cases and response mappers

**Files:**
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/create-property-engagement.use-case.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/list-property-engagements.use-case.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/get-property-engagement.use-case.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/use-cases/assign-property-agent.use-case.ts`
- Create: `viewpro-app/apps/api/src/property-engagements/responses/property-engagement.response.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`

**Step 1: Add response mapper**

Mapper returns safe fields only:

```ts
export function mapPropertyEngagement(engagement: PropertyEngagementWithDetails) {
  return {
    id: engagement.id,
    tenantId: engagement.tenantId,
    operationType: engagement.operationType,
    status: engagement.status,
    publishedPriceCents: engagement.publishedPriceCents,
    currency: engagement.currency,
    property: {
      id: engagement.propertyAsset.id,
      title: engagement.propertyAsset.title,
      addressLine: engagement.propertyAsset.addressLine,
      city: engagement.propertyAsset.city,
      province: engagement.propertyAsset.province,
      propertyType: engagement.propertyAsset.propertyType,
      ownerName: engagement.propertyAsset.ownerName,
      ownerEmail: engagement.propertyAsset.ownerEmail,
    },
    agents: engagement.agents.map((agent) => ({
      id: agent.id,
      userId: agent.agentUserId,
      email: agent.agentUser.email,
      firstName: agent.agentUser.firstName,
    })),
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
  }
}
```

**Step 2: Add permission helper**

Create a local helper inside use cases or a small private function:

```ts
const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
```

If user has only `ENGAGEMENTS_VIEW_ASSIGNED`, repository must restrict to assignments.

**Step 3: Assignment validation**

`assign-property-agent.use-case.ts` must inject `MEMBERSHIPS_REPOSITORY` and verify the assigned user belongs to `tenant.tenantId` before creating `PropertyAgent`.

If no membership exists, throw `BadRequestException('Agent is not a member of this tenant')`.

**Step 4: Register use cases**

Add all use cases to module providers.

**Step 5: Run typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 5: Add controller with guard chain

**Files:**
- Create: `viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`

**Step 1: Implement controller**

Use Stage 3 guards:

```ts
@Controller('property-engagements')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class PropertyEngagementsController {
  @Post()
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  create(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: CurrentUser, @Body() body: CreatePropertyEngagementDto) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL, PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)
  list(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: CurrentUser, @Query() query: ListPropertyEngagementsQuery) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL, PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)
  get(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: CurrentUser, @Param('id') id: string) {}

  @Post(':id/agents')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  assignAgent(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() body: AssignPropertyAgentDto) {}
}
```

Important: `PermissionGuard` currently requires every listed permission. For list/detail, do not pass both view permissions to one decorator unless the guard is changed to OR semantics. Preferred Stage 4 implementation:

- Create a small `EngagementAccessGuard`, or
- Keep controller guarded by tenant membership and perform view-all vs assigned logic in use cases after checking `tenant.permissions`.

Recommendation: Use case checks are simpler for Stage 4. Put `@RequirePermissions(PERMISSIONS.TENANT_VIEW)` on list/detail only if a guard-level permission is needed, then enforce engagement view scope in use cases.

**Step 2: Add assign DTO**

Create `dto/assign-property-agent.dto.ts`:

```ts
import { IsUUID } from 'class-validator'

export class AssignPropertyAgentDto {
  @IsUUID()
  agentUserId!: string
}
```

**Step 3: Register controller**

Add controller to module.

**Step 4: Run typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 6: Add e2e tests

**Files:**
- Create: `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`

**Test setup:**

Use the existing auth flow to register tenants/users. Use Prisma directly only for role/membership setup when needed.

**Test cases:**

1. Manager creates property asset + engagement with `x-tenant-id`.
2. Missing `x-tenant-id` returns `403`.
3. Tenant A cannot list Tenant B engagement.
4. Tenant A cannot read Tenant B engagement by id; expect `404`.
5. Manager lists all engagements in tenant with pagination.
6. Agent only sees assigned engagements.
7. Agent cannot create engagement; expect `403`.
8. Manager assigns an agent who belongs to the tenant.
9. Manager cannot assign a user outside the tenant; expect `400`.

**Step 1: Write failing tests first**

```bash
pnpm --filter @viewpro/api test -- property-engagements.e2e-spec.ts
```

Expected before implementation: fail because endpoint/module does not exist.

**Step 2: Implement until tests pass**

Run after each meaningful change:

```bash
pnpm --filter @viewpro/api test -- property-engagements.e2e-spec.ts
```

Expected final result: all property engagement tests pass.

---

## Task 7: Update docs and roadmap

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

**Docs must state:**

- Stage 4 backend supports property assets and tenant-scoped engagements.
- Owner users/portal are intentionally out of scope.
- Tenant-scoped endpoints require `x-tenant-id`.
- Agents see only assigned engagements; managers see all tenant engagements.

---

## Task 8: Final verification

**Files:**
- No new files unless fixes are required.

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

**Step 2: Inspect git status**

Run from repo root:

```bash
git status --short --branch
```

Expected: only intended Stage 4 files are modified/untracked.

---

## Acceptance checklist

- [ ] `PropertyAsset`, `PropertyEngagement`, and `PropertyAgent` exist in Prisma with migration.
- [ ] Manager can create property + engagement.
- [ ] Manager can list/read all tenant engagements.
- [ ] Agent can list/read only assigned engagements.
- [ ] Agent cannot create or assign.
- [ ] Tenant A cannot infer Tenant B engagement existence.
- [ ] Assigning an agent validates same-tenant membership.
- [ ] E2E tests prove tenant isolation and role behavior.
- [ ] Full verification commands pass.

## Review workload forecast

- Estimated changed lines: 700-1,100 including migration, tests, and docs.
- 400-line budget risk: High.
- Chained PRs recommended: Yes if this must go through review in small slices.
- Suggested slices:
  1. Prisma models + repository + tests scaffolding.
  2. Create/list/detail endpoints + e2e.
  3. Agent assignment + docs + final verification.

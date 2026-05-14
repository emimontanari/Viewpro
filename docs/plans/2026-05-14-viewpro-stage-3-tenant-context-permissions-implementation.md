# ViewPro Stage 3 Tenant Context + Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver tenant activo y permisos backend para que cada request protegida se ejecute dentro de una inmobiliaria validada.

**Architecture:** El frontend puede navegar por `tenantSlug`, pero la API recibe el tenant activo por header `x-tenant-id`. El backend encadena `AuthGuard` → `TenantMembershipGuard` → `PermissionGuard`: primero identifica usuario, después valida membresía en el tenant, y recién entonces valida permisos granulares derivados del rol.

**Tech Stack:** NestJS Guards/Decorators/Metadata, Prisma, cookies `httpOnly`, Vitest + Supertest e2e.

---

## Decisiones de Etapa 3

| Tema | Decisión |
|---|---|
| Tenant activo API | Header `x-tenant-id` |
| URL frontend | Puede usar `/app/[tenantSlug]` para UX |
| Seguridad | Backend valida membresía por `tenantId` real |
| Permisos MVP | Derivados de rol fijo |
| Roles | `PRINCIPAL_MANAGER`, `MANAGER`, `AGENT` |
| Decorator permisos | `@RequirePermissions(...)` |
| Tenant decorator | `@CurrentTenant()` |
| User decorator | Reusar `@CurrentUser()` |

Regla central:

> El frontend puede mandar contexto. El backend decide si ese contexto es válido.

---

## Scope

### Incluye

- `TenantMembershipGuard`.
- `PermissionGuard`.
- Decorators:
  - `@CurrentTenant()`
  - `@RequirePermissions(...)`
- Tipo `TenantContext` en request.
- Permisos iniciales por rol.
- `/me` enriquecido con permisos por membership.
- Endpoint demo protegido para validar guard composition.
- Tests e2e de acceso por tenant y permisos.

### No incluye

- UI de selección tenant.
- Persistencia de tenant activo en frontend.
- Scopes por sucursal/equipo.
- Roles editables por tenant.
- Platform owner real.
- Propiedades/gestiones/movimientos.

---

## Permission model MVP

Crear permisos como strings explícitos.

```ts
export const PERMISSIONS = {
  TENANT_VIEW: 'tenant.view',
  TENANT_MANAGE_SETTINGS: 'tenant.manage_settings',
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  ENGAGEMENTS_VIEW_ALL: 'engagements.view_all',
  ENGAGEMENTS_VIEW_ASSIGNED: 'engagements.view_assigned',
  ENGAGEMENTS_CREATE: 'engagements.create',
  MOVEMENTS_CREATE: 'movements.create',
  DOCUMENTS_VIEW_ALL: 'documents.view_all',
  DOCUMENTS_REQUEST: 'documents.request',
  DOCUMENTS_REVIEW_OWN: 'documents.review_own',
} as const
```

Role mapping:

```txt
PRINCIPAL_MANAGER
  all MVP permissions

MANAGER
  tenant.view
  team.view
  engagements.view_all
  engagements.create
  movements.create
  documents.view_all
  documents.request

AGENT
  tenant.view
  engagements.view_assigned
  movements.create
  documents.request
  documents.review_own
```

---

## Task 1: Extender repositorio de memberships

**Files:**
- Modify: `viewpro-app/apps/api/src/memberships/memberships.repository.ts`
- Modify: `viewpro-app/apps/api/src/memberships/prisma-memberships.repository.ts`

**Step 1: Agregar tipo `MembershipWithUserAndTenant`**

```ts
import type { Prisma, TenantMembership } from '@prisma/client'

export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY')

export type MembershipWithTenant = Prisma.TenantMembershipGetPayload<{ include: { tenant: true } }>

export type MembershipWithUserAndTenant = Prisma.TenantMembershipGetPayload<{
  include: { user: true; tenant: true }
}>

export type MembershipsRepository = {
  create(data: Prisma.TenantMembershipCreateInput): Promise<TenantMembership>
  findManyByUserId(userId: string): Promise<MembershipWithTenant[]>
  findByUserIdAndTenantId(userId: string, tenantId: string): Promise<MembershipWithUserAndTenant | null>
}
```

**Step 2: Implementar query Prisma**

```ts
findByUserIdAndTenantId(userId: string, tenantId: string) {
  return this.prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { user: true, tenant: true },
  })
}
```

**Step 3: Verificar typecheck**

```bash
pnpm --filter @viewpro/api typecheck
```

---

## Task 2: Crear permission model

**Files:**
- Create: `viewpro-app/apps/api/src/permissions/permissions.constants.ts`
- Create: `viewpro-app/apps/api/src/permissions/role-permissions.ts`
- Create: `viewpro-app/apps/api/src/permissions/permissions.module.ts`

**Step 1: Crear constantes**

`permissions.constants.ts`:

```ts
export const PERMISSIONS = {
  TENANT_VIEW: 'tenant.view',
  TENANT_MANAGE_SETTINGS: 'tenant.manage_settings',
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  ENGAGEMENTS_VIEW_ALL: 'engagements.view_all',
  ENGAGEMENTS_VIEW_ASSIGNED: 'engagements.view_assigned',
  ENGAGEMENTS_CREATE: 'engagements.create',
  MOVEMENTS_CREATE: 'movements.create',
  DOCUMENTS_VIEW_ALL: 'documents.view_all',
  DOCUMENTS_REQUEST: 'documents.request',
  DOCUMENTS_REVIEW_OWN: 'documents.review_own',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
```

**Step 2: Crear role mapping**

`role-permissions.ts`:

```ts
import { TenantRole } from '@prisma/client'
import { PERMISSIONS, type Permission } from './permissions.constants'

const ALL_MVP_PERMISSIONS = Object.values(PERMISSIONS)

export const ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  [TenantRole.PRINCIPAL_MANAGER]: ALL_MVP_PERMISSIONS,
  [TenantRole.MANAGER]: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
    PERMISSIONS.ENGAGEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.DOCUMENTS_REQUEST,
  ],
  [TenantRole.AGENT]: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.DOCUMENTS_REQUEST,
    PERMISSIONS.DOCUMENTS_REVIEW_OWN,
  ],
}

export function getPermissionsForRole(role: TenantRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
```

**Step 3: Crear module placeholder**

`permissions.module.ts`:

```ts
import { Module } from '@nestjs/common'

@Module({})
export class PermissionsModule {}
```

---

## Task 3: Crear tenant context types/decorators

**Files:**
- Create: `viewpro-app/apps/api/src/tenant-context/tenant-context.types.ts`
- Create: `viewpro-app/apps/api/src/tenant-context/current-tenant.decorator.ts`
- Create: `viewpro-app/apps/api/src/tenant-context/tenant-context.module.ts`

**Step 1: Crear types**

```ts
import type { TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import type { Permission } from '../permissions/permissions.constants'

export type TenantContext = {
  tenantId: string
  tenantSlug: string
  tenantStatus: TenantStatus
  membershipId: string
  role: TenantRole
  permissions: Permission[]
  userStatus: UserStatus
}

export type RequestWithTenantContext = {
  tenantContext?: TenantContext
}
```

**Step 2: Crear decorator `@CurrentTenant()`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { RequestWithTenantContext, TenantContext } from './tenant-context.types'

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
  const request = ctx.switchToHttp().getRequest<Request & RequestWithTenantContext>()
  return request.tenantContext
})
```

**Step 3: Crear module**

```ts
import { Module } from '@nestjs/common'
import { MembershipsModule } from '../memberships/memberships.module'

@Module({
  imports: [MembershipsModule],
})
export class TenantContextModule {}
```

---

## Task 4: Crear `TenantMembershipGuard`

**Files:**
- Create: `viewpro-app/apps/api/src/tenant-context/tenant-membership.guard.ts`

**Behavior:**

Reads:

```txt
request.user.id
header x-tenant-id
```

Validates:

- user authenticated
- header exists
- membership exists for user + tenant
- user status is `ACTIVE`
- tenant status is not `SUSPENDED` or `CANCELLED`

Attaches:

```txt
request.tenantContext
```

Implementation:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { TenantStatus, UserStatus } from '@prisma/client'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../auth/guards/auth.guard'
import { MEMBERSHIPS_REPOSITORY, type MembershipsRepository } from '../memberships/memberships.repository'
import { getPermissionsForRole } from '../permissions/role-permissions'
import type { RequestWithTenantContext } from './tenant-context.types'

const TENANT_ID_HEADER = 'x-tenant-id'

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request & RequestWithTenantContext>()

    if (!request.user) {
      throw new UnauthorizedException('Authentication required')
    }

    const tenantId = request.header(TENANT_ID_HEADER)

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required')
    }

    const membership = await this.membershipsRepository.findByUserIdAndTenantId(request.user.id, tenantId)

    if (!membership) {
      throw new ForbiddenException('Tenant access denied')
    }

    if (membership.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active')
    }

    if ([TenantStatus.SUSPENDED, TenantStatus.CANCELLED].includes(membership.tenant.status)) {
      throw new ForbiddenException('Tenant is not active')
    }

    request.tenantContext = {
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      tenantStatus: membership.tenant.status,
      membershipId: membership.id,
      role: membership.role,
      permissions: getPermissionsForRole(membership.role),
      userStatus: membership.user.status,
    }

    return true
  }
}
```

---

## Task 5: Crear `PermissionGuard` y decorator

**Files:**
- Create: `viewpro-app/apps/api/src/permissions/require-permissions.decorator.ts`
- Create: `viewpro-app/apps/api/src/permissions/permission.guard.ts`
- Modify: `viewpro-app/apps/api/src/permissions/permissions.module.ts`

**Decorator:**

```ts
import { SetMetadata } from '@nestjs/common'
import type { Permission } from './permissions.constants'

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions'

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions)
```

**Guard:**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { RequestWithTenantContext } from '../tenant-context/tenant-context.types'
import type { Permission } from './permissions.constants'
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? []

    if (requiredPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & RequestWithTenantContext>()
    const permissions = request.tenantContext?.permissions ?? []

    const hasEveryPermission = requiredPermissions.every((permission) => permissions.includes(permission))

    if (!hasEveryPermission) {
      throw new ForbiddenException('Insufficient permissions')
    }

    return true
  }
}
```

**Module:**

```ts
import { Module } from '@nestjs/common'
import { PermissionGuard } from './permission.guard'

@Module({
  providers: [PermissionGuard],
  exports: [PermissionGuard],
})
export class PermissionsModule {}
```

---

## Task 6: Enriquecer `/me` con permisos

**Files:**
- Modify: `viewpro-app/apps/api/src/auth/responses/me.response.ts`

**Step:** Add `permissions` to membership response.

```ts
import { getPermissionsForRole } from '../../permissions/role-permissions'
import type { Permission } from '../../permissions/permissions.constants'

export type MembershipResponse = {
  id: string
  role: string
  permissions: Permission[]
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
}

export function mapMembership(membership: MembershipWithTenant): MembershipResponse {
  return {
    id: membership.id,
    role: membership.role,
    permissions: getPermissionsForRole(membership.role),
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      status: membership.tenant.status,
    },
  }
}
```

---

## Task 7: Crear endpoint demo protegido para tests

**Files:**
- Create: `viewpro-app/apps/api/src/tenant-context/tenant-context-demo.controller.ts`
- Modify: `viewpro-app/apps/api/src/tenant-context/tenant-context.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Controller:**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { PermissionGuard } from '../permissions/permission.guard'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from './current-tenant.decorator'
import { TenantMembershipGuard } from './tenant-membership.guard'
import type { TenantContext } from './tenant-context.types'

@Controller('tenant-context/demo')
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TenantContextDemoController {
  @Get('view')
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  view(@CurrentTenant() tenant: TenantContext) {
    return { tenant }
  }

  @Get('manage-settings')
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)
  manageSettings(@CurrentTenant() tenant: TenantContext) {
    return { tenant }
  }
}
```

**Module:**

```ts
@Module({
  imports: [MembershipsModule, PermissionsModule],
  controllers: [TenantContextDemoController],
  providers: [TenantMembershipGuard],
  exports: [TenantMembershipGuard],
})
export class TenantContextModule {}
```

**AppModule:**

```ts
imports: [
  ConfigModule,
  DatabaseModule,
  UsersModule,
  TenantsModule,
  MembershipsModule,
  AuthModule,
  PermissionsModule,
  TenantContextModule,
  HealthModule,
]
```

---

## Task 8: E2E tests tenant context + permissions

**Files:**
- Create: `viewpro-app/apps/api/test/tenant-context.e2e-spec.ts`
- Modify: `viewpro-app/apps/api/test/auth.e2e-spec.ts` if `/me` expectation needs permissions.

**Test cases:**

1. `/me` includes permissions per membership.
2. Protected endpoint without `x-tenant-id` returns 403.
3. Protected endpoint with unrelated tenant returns 403.
4. Protected endpoint with valid tenant returns 200 and tenant context.
5. Agent can access `tenant.view` endpoint.
6. Agent cannot access `tenant.manage_settings` endpoint.
7. Principal manager can access `tenant.manage_settings` endpoint.
8. Suspended tenant rejects access.

**Test setup helper:**

Register two tenants/users through auth endpoint. For agent role, directly insert a membership with `TenantRole.AGENT` for a test user if needed.

**Commands:**

```bash
pnpm --filter @viewpro/api test
```

---

## Task 9: Docs and final verification

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

**Docs add:**

```md
Stage 3 backend tenant context uses `x-tenant-id` on protected tenant requests.
```

**Final verification:**

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

Run from repo root:

```bash
git status --short --branch
```

---

## Acceptance checklist

- [ ] Backend accepts tenant context through `x-tenant-id`.
- [ ] Missing tenant context fails.
- [ ] Tenant not owned by user fails.
- [ ] Suspended/cancelled tenant fails.
- [ ] Valid tenant membership attaches `tenantContext` to request.
- [ ] Permissions derive from role.
- [ ] Missing permission fails.
- [ ] `/me` includes permissions per tenant membership.
- [ ] Tests prove backend authority independent of UI.

## Known follow-ups

- Apply guards to real property/engagement endpoints in Etapa 4.
- Add platform owner access separately.
- Add owner portal access separately.
- Add editable roles/permissions in future.

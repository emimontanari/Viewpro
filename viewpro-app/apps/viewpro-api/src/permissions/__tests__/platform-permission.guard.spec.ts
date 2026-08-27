import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { Operator } from '@prisma-platform/client'
import { PlatformPermissionGuard } from '../platform-permission.guard'
import type { IOperatorRepository } from '../../auth/repositories/operator.repository'
import { PLATFORM_PERMISSIONS } from '../platform-permissions.constants'

/**
 * T-05 — RED: PlatformPermissionGuard unit matrix (mocked ExecutionContext,
 * Reflector, IOperatorRepository).
 *
 * Spec: operator-platform-roles — Protected Routes Fail Closed When No
 *   Permission Is Declared; Read/Write Routes Require the Declared
 *   Permission; Guard Order Keeps 401/403 Distinct (unit-level 401 branch)
 * Design: D5 (fail-closed), D6 (guard flow + 403 contract)
 */

const OPERATOR_ID = 'op-123'

function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: OPERATOR_ID,
    email: 'op@viewpro.app',
    passwordHash: '$argon2id$hashed',
    status: 'ACTIVE',
    role: 'OWNER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeContext(overrides: { userId?: string } = {}): ExecutionContext {
  const request = {
    user: overrides.userId ? { id: overrides.userId, email: 'op@viewpro.app' } : undefined,
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext
}

function makeGuard(options: {
  metadata?: string | undefined
  findById?: ReturnType<typeof vi.fn>
}) {
  const operatorRepository: { findById: ReturnType<typeof vi.fn>; findByEmail: ReturnType<typeof vi.fn> } = {
    findById: options.findById ?? vi.fn().mockResolvedValue(makeOperator()),
    findByEmail: vi.fn(),
  }
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.metadata),
  }

  return {
    guard: new PlatformPermissionGuard(
      operatorRepository as unknown as IOperatorRepository,
      reflector as unknown as Reflector,
    ),
    operatorRepository,
    reflector,
  }
}

const PERMISSION_DENIED_RESPONSE = {
  statusCode: 403,
  code: 'PERMISSION_DENIED',
  message: 'Insufficient permissions',
}

describe('PlatformPermissionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no @RequirePlatformPermission metadata → 403 PERMISSION_DENIED (fail-closed, D5)', async () => {
    const { guard } = makeGuard({ metadata: undefined })
    const context = makeContext({ userId: OPERATOR_ID })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)

    const error = await guard.canActivate(context).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getResponse()).toEqual(PERMISSION_DENIED_RESPONSE)
  })

  it('metadata present but request.user absent → UnauthorizedException (defensive, unreachable behind AuthGuard)', async () => {
    const { guard } = makeGuard({ metadata: PLATFORM_PERMISSIONS.METRICS_READ })
    const context = makeContext({ userId: undefined })

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
  })

  it('metadata present, operator not found → 403 PERMISSION_DENIED', async () => {
    const findById = vi.fn().mockResolvedValue(null)
    const { guard } = makeGuard({ metadata: PLATFORM_PERMISSIONS.METRICS_READ, findById })
    const context = makeContext({ userId: OPERATOR_ID })

    const error = await guard.canActivate(context).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getResponse()).toEqual(PERMISSION_DENIED_RESPONSE)
  })

  it('operator SUSPENDED → 403 PERMISSION_DENIED even though the role would otherwise grant the permission (status hardening, D6)', async () => {
    const findById = vi.fn().mockResolvedValue(makeOperator({ status: 'SUSPENDED', role: 'OWNER' }))
    const { guard } = makeGuard({ metadata: PLATFORM_PERMISSIONS.METRICS_READ, findById })
    const context = makeContext({ userId: OPERATOR_ID })

    const error = await guard.canActivate(context).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getResponse()).toEqual(PERMISSION_DENIED_RESPONSE)
  })

  it('operator ACTIVE but role lacks the required permission → 403 PERMISSION_DENIED', async () => {
    const findById = vi.fn().mockResolvedValue(makeOperator({ status: 'ACTIVE', role: 'ANALYST' }))
    const { guard } = makeGuard({ metadata: PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE, findById })
    const context = makeContext({ userId: OPERATOR_ID })

    const error = await guard.canActivate(context).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getResponse()).toEqual(PERMISSION_DENIED_RESPONSE)
  })

  it('operator ACTIVE and role grants the required permission → canActivate resolves true', async () => {
    const findById = vi.fn().mockResolvedValue(makeOperator({ status: 'ACTIVE', role: 'ANALYST' }))
    const { guard } = makeGuard({ metadata: PLATFORM_PERMISSIONS.METRICS_READ, findById })
    const context = makeContext({ userId: OPERATOR_ID })

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })
})

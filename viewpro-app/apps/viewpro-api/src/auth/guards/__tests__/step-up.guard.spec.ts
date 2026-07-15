import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { StepUpGuard, STEP_UP_STATUS_TARGETS_KEY } from '../step-up.guard'
import type { TokenService } from '../../tokens/token.service'

const OPERATOR_ID = 'op-123'

function makeContext(overrides: {
  cookies?: Record<string, string | undefined>
  userId?: string
  body?: Record<string, unknown>
}): ExecutionContext {
  const request = {
    cookies: overrides.cookies ?? {},
    user: overrides.userId ? { id: overrides.userId, email: 'op@viewpro.app' } : undefined,
    body: overrides.body ?? {},
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
  verifyStepUpToken?: ReturnType<typeof vi.fn>
  metadata?: string[] | undefined
}) {
  const tokenService = {
    verifyStepUpToken:
      options.verifyStepUpToken ?? vi.fn().mockResolvedValue({ sub: OPERATOR_ID, stepUp: true }),
  }
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.metadata),
  }

  return {
    guard: new StepUpGuard(tokenService as unknown as TokenService, reflector as unknown as Reflector),
    tokenService,
    reflector,
  }
}

describe('StepUpGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no step-up cookie throws ForbiddenException with STEP_UP_REQUIRED body', async () => {
    const { guard } = makeGuard({ metadata: undefined })
    const context = makeContext({ cookies: {}, userId: OPERATOR_ID })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)

    try {
      await guard.canActivate(context)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException)
      const response = (error as ForbiddenException).getResponse()
      expect(response).toEqual({
        statusCode: 403,
        code: 'STEP_UP_REQUIRED',
        message: 'Step-up verification required',
      })
    }
  })

  it('expired/forged step-up cookie (verify rejects) throws the same 403 shape', async () => {
    const verifyStepUpToken = vi.fn().mockRejectedValue(new Error('invalid token'))
    const { guard } = makeGuard({ verifyStepUpToken, metadata: undefined })
    const context = makeContext({
      cookies: { viewpro_platform_stepup_token: 'forged.token.value' },
      userId: OPERATOR_ID,
    })

    try {
      await guard.canActivate(context)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException)
      const response = (error as ForbiddenException).getResponse()
      expect(response).toEqual({
        statusCode: 403,
        code: 'STEP_UP_REQUIRED',
        message: 'Step-up verification required',
      })
    }
  })

  it('valid step-up cookie but payload.sub !== request.user.id throws 403 STEP_UP_REQUIRED (AC5)', async () => {
    const verifyStepUpToken = vi.fn().mockResolvedValue({ sub: 'other-operator', stepUp: true })
    const { guard } = makeGuard({ verifyStepUpToken, metadata: undefined })
    const context = makeContext({
      cookies: { viewpro_platform_stepup_token: 'valid.token.for.other' },
      userId: OPERATOR_ID,
    })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('@StepUpStatusTargets metadata present + body.status === ACTIVE → canActivate returns true without checking the cookie (AC6)', async () => {
    const verifyStepUpToken = vi.fn()
    const { guard } = makeGuard({ verifyStepUpToken, metadata: ['SUSPENDED', 'CANCELLED'] })
    const context = makeContext({
      cookies: {},
      userId: OPERATOR_ID,
      body: { status: 'ACTIVE' },
    })

    const result = await guard.canActivate(context)

    expect(result).toBe(true)
    expect(verifyStepUpToken).not.toHaveBeenCalled()
  })

  it('same metadata + body.status === SUSPENDED → cookie check required', async () => {
    const { guard } = makeGuard({ metadata: ['SUSPENDED', 'CANCELLED'] })
    const context = makeContext({
      cookies: {},
      userId: OPERATOR_ID,
      body: { status: 'SUSPENDED' },
    })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('same metadata + body.status === CANCELLED → cookie check required', async () => {
    const { guard } = makeGuard({ metadata: ['SUSPENDED', 'CANCELLED'] })
    const context = makeContext({
      cookies: {},
      userId: OPERATOR_ID,
      body: { status: 'CANCELLED' },
    })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('no metadata (limits route) → cookie check always required, regardless of body', async () => {
    const { guard } = makeGuard({ metadata: undefined })
    const context = makeContext({
      cookies: {},
      userId: OPERATOR_ID,
      body: { maxUsers: 10 },
    })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('no metadata + valid, sub-matching step-up cookie → returns true', async () => {
    const verifyStepUpToken = vi.fn().mockResolvedValue({ sub: OPERATOR_ID, stepUp: true })
    const { guard } = makeGuard({ verifyStepUpToken, metadata: undefined })
    const context = makeContext({
      cookies: { viewpro_platform_stepup_token: 'valid.token' },
      userId: OPERATOR_ID,
      body: { maxUsers: 10 },
    })

    const result = await guard.canActivate(context)

    expect(result).toBe(true)
  })
})

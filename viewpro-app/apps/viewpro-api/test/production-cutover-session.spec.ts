import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, it, vi } from 'vitest'
import { ACCESS_TOKEN_COOKIE, STEP_UP_TOKEN_COOKIE } from '../src/auth/auth.constants'
import { AuthGuard } from '../src/auth/guards/auth.guard'
import { StepUpGuard } from '../src/auth/guards/step-up.guard'
import { TokenService } from '../src/auth/tokens/token.service'

// RED-CUT-13, platform lane. A platform access token is accepted without any database
// lookup, so rotating the access and step-up secrets is the ONLY lever that retires an
// old operator session. The control secret is deliberately not rotated.
//
// Everything here is driven through the REAL TokenService over a real config shape, so
// the lever under test is the one production uses — the secret the service reads from
// configuration — rather than a secret the test hands to its own verifier. Against a
// stub these assertions would only restate how HMAC works.
//
// The assertions hold no database, no Nest bootstrap and no network. The suite still
// runs under this workspace's vitest globalSetup, which migrates a worker database
// before any file, so it is not immune to that infrastructure — only its assertions are.

const RETIRED_ACCESS = 'test-access-token-secret-generation-1'
const CURRENT_ACCESS = 'test-access-token-secret-generation-2'
const RETIRED_STEP_UP = 'test-step-up-token-secret-generation-1'
const CURRENT_STEP_UP = 'test-step-up-token-secret-generation-2'
const CONTROL_SECRET = 'test-platform-control-secret-min16'

// Mirrors the keys TokenService and AuthGuard actually read, at the deployed defaults.
// A constant-returning stub would answer every key alike and hide a guard that began
// reading a different one.
function configFor(accessSecret: string, stepUpSecret: string) {
  const values: Record<string, unknown> = {
    'app.auth.idleTimeoutSeconds': 600,
    'app.auth.absoluteSessionSeconds': 28800,
    'app.auth.accessTokenSecret': accessSecret,
    'app.auth.stepUpTokenSecret': stepUpSecret,
    'app.auth.stepUpTtlSeconds': 300,
    'app.cookies.domain': undefined,
    'app.cookies.secure': false,
  }
  return { get: (key: string, fallback?: unknown) => values[key] ?? fallback }
}

// One generation of the platform: the JwtService the module registers from the access
// secret, the real TokenService over it, and the two real guards.
function generation(accessSecret: string, stepUpSecret: string) {
  const config = configFor(accessSecret, stepUpSecret)
  const tokenService = new TokenService(new JwtService({ secret: accessSecret }), config as never)
  const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector
  return {
    tokenService,
    auth: new AuthGuard(tokenService, config as never),
    stepUp: new StepUpGuard(tokenService, reflector),
  }
}

// No route here declares a step-up status target, so `statusTargets` is inapplicable.
function makeContext(cookies: Record<string, string | undefined>, user?: { id: string }) {
  const request = { cookies, user, body: {} }
  const response = { clearCookie: vi.fn(), cookie: vi.fn() }
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext,
    response,
  }
}

const previous = generation(RETIRED_ACCESS, RETIRED_STEP_UP)
const current = generation(CURRENT_ACCESS, CURRENT_STEP_UP)

describe('production cutover — platform session invalidation', () => {
  it('retires an access token the previous generation minted', async () => {
    // Minted by one generation's real service, judged by the next generation's real
    // guard: this fails if the service stops reading its secret from configuration, or
    // if the guard stops verifying the signature at all.
    const retired = await previous.tokenService.signAccessToken({
      sub: 'op-1',
      email: 'op@viewpro.test',
    })
    const { context, response } = makeContext({ [ACCESS_TOKEN_COOKIE]: retired })

    await expect(current.auth.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: 'AUTH_REQUIRED' },
    })
    // Both cookies are cleared on the way out, so a rejected operator is not left
    // holding a step-up cookie the next request would present again.
    expect(response.clearCookie).toHaveBeenCalledTimes(2)

    // The same token still passes its own generation's guard, so the rejection above is
    // the rotation rather than a malformed fixture.
    await expect(
      previous.auth.canActivate(makeContext({ [ACCESS_TOKEN_COOKIE]: retired }).context),
    ).resolves.toBe(true)
  })

  it('admits an access token the current generation minted', async () => {
    const token = await current.tokenService.signAccessToken({
      sub: 'op-2',
      email: 'b@viewpro.test',
    })

    await expect(
      current.auth.canActivate(makeContext({ [ACCESS_TOKEN_COOKIE]: token }).context),
    ).resolves.toBe(true)
  })

  it('refuses a token whose session expiry claim is absent or unusable', async () => {
    // The previous generation minted access tokens without `sessionExp`, and such a
    // token must be refused rather than read as a session that never ends. `NaN` is the
    // sharper case: `typeof NaN === 'number'` and `now > NaN + tolerance` is false, so
    // any check weaker than `Number.isFinite` reads it as unexpiring.
    for (const claims of [
      { sub: 'op-1', email: 'op@viewpro.test' },
      { sub: 'op-1', email: 'op@viewpro.test', sessionExp: Number.NaN },
      { sub: 'op-1', email: 'op@viewpro.test', sessionExp: 'later' },
    ]) {
      const token = await new JwtService({ secret: CURRENT_ACCESS }).signAsync(claims)
      await expect(
        current.auth.canActivate(makeContext({ [ACCESS_TOKEN_COOKIE]: token }).context),
      ).rejects.toMatchObject({ status: 401, response: { code: 'AUTH_REQUIRED' } })
    }
  })

  it('refuses a token whose absolute session deadline has passed', async () => {
    const elapsed = Math.floor(Date.now() / 1000) - 60
    const token = await new JwtService({ secret: CURRENT_ACCESS }).signAsync({
      sub: 'op-1',
      email: 'op@viewpro.test',
      sessionExp: elapsed,
    })

    await expect(
      current.auth.canActivate(makeContext({ [ACCESS_TOKEN_COOKIE]: token }).context),
    ).rejects.toMatchObject({ status: 401, response: { code: 'AUTH_REQUIRED' } })
  })

  it('retires a step-up token the previous generation minted', async () => {
    const retired = await previous.tokenService.signStepUpToken({ sub: 'op-1' })

    await expect(
      current.stepUp.canActivate(
        makeContext({ [STEP_UP_TOKEN_COOKIE]: retired }, { id: 'op-1' }).context,
      ),
    ).rejects.toMatchObject({ status: 403, response: { code: 'STEP_UP_REQUIRED' } })

    // The verifier really was reached and really rejected the signature, rather than the
    // guard's broad catch swallowing an unrelated fault such as a missing method.
    await expect(current.tokenService.verifyStepUpToken(retired)).rejects.toThrow(/signature/i)
  })

  it('admits a step-up token the current generation minted, for its own subject only', async () => {
    const token = await current.tokenService.signStepUpToken({ sub: 'op-1' })

    await expect(
      current.stepUp.canActivate(
        makeContext({ [STEP_UP_TOKEN_COOKIE]: token }, { id: 'op-1' }).context,
      ),
    ).resolves.toBe(true)
    await expect(
      current.stepUp.canActivate(
        makeContext({ [STEP_UP_TOKEN_COOKIE]: token }, { id: 'op-2' }).context,
      ),
    ).rejects.toMatchObject({ status: 403, response: { code: 'STEP_UP_REQUIRED' } })
  })

  it('refuses a step-up token that carries no step-up claim', async () => {
    // Signed with the right secret for the right subject, but never elevated: the claim
    // is what separates a step-up from an ordinary token minted on the same key.
    const notElevated = await new JwtService({ secret: CURRENT_STEP_UP }).signAsync({ sub: 'op-1' })

    await expect(
      current.stepUp.canActivate(
        makeContext({ [STEP_UP_TOKEN_COOKIE]: notElevated }, { id: 'op-1' }).context,
      ),
    ).rejects.toMatchObject({ status: 403, response: { code: 'STEP_UP_REQUIRED' } })
  })

  it('rotates access and step-up independently', async () => {
    // Rotating one secret must not silently retire tokens signed under the other, or a
    // half-finished rotation would look complete.
    const access = await current.tokenService.signAccessToken({
      sub: 'op-1',
      email: 'a@viewpro.test',
    })
    const stepUp = await current.tokenService.signStepUpToken({ sub: 'op-1' })

    await expect(current.tokenService.verifyAccessToken(access)).resolves.toMatchObject({
      sub: 'op-1',
    })
    await expect(current.tokenService.verifyStepUpToken(stepUp)).resolves.toMatchObject({
      sub: 'op-1',
    })
    // Neither token verifies as the other kind.
    await expect(current.tokenService.verifyStepUpToken(access)).rejects.toThrow('invalid signature')
    await expect(current.tokenService.verifyAccessToken(stepUp)).rejects.toThrow('invalid signature')
  })

  it('leaves the control lane untouched by a session rotation', async () => {
    // The control secret authenticates a backend-to-backend lane, not a human session.
    // Rotating it would add a cross-backend atomicity dependency the cutover cannot
    // satisfy, so it is deliberately not rotated. Minted with the issuer, audience and
    // token id the real control verifier requires, so this is a token that lane would
    // actually accept rather than a bare signature.
    const controlToken = await new JwtService({ secret: CONTROL_SECRET }).signAsync(
      { sub: 'inmoview', jti: 'jti-1' },
      { issuer: 'viewpro-api', audience: 'inmoview-control', expiresIn: '15m' },
    )

    await expect(current.tokenService.verifyAccessToken(controlToken)).rejects.toThrow('invalid signature')
    await expect(current.tokenService.verifyStepUpToken(controlToken)).rejects.toThrow('invalid signature')

    // And a session token fails the control lane's own requirements, not merely its key.
    const session = await current.tokenService.signAccessToken({
      sub: 'op-1',
      email: 'a@viewpro.test',
    })
    await expect(
      new JwtService({ secret: CONTROL_SECRET }).verifyAsync(session, {
        secret: CONTROL_SECRET,
        issuer: 'viewpro-api',
        audience: 'inmoview-control',
      }),
    ).rejects.toThrow('invalid signature')
  })

  it('refuses a request carrying no cookie at all', async () => {
    const { context, response } = makeContext({})
    await expect(current.auth.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: 'AUTH_REQUIRED' },
    })
    expect(response.clearCookie).toHaveBeenCalledTimes(2)

    await expect(
      current.stepUp.canActivate(makeContext({}, { id: 'op-1' }).context),
    ).rejects.toMatchObject({ status: 403, response: { code: 'STEP_UP_REQUIRED' } })
  })
})

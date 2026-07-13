import { JwtService } from '@nestjs/jwt'
import type { PlatformServiceIdentity } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

const REQUIRED_ISS = 'viewpro-api'
const REQUIRED_AUD = 'inmoview-control'

export type ServiceTokenPayload = {
  iss: string
  aud: string | string[]
  sub: string
  jti: string
  exp: number
}

/**
 * Standalone verify-only helper for the platform control service token.
 * Validates iss, aud, exp (with clock skew), and returns PlatformServiceIdentity.
 *
 * Uses its own JwtService instance scoped to PLATFORM_CONTROL_SECRET.
 * Does NOT use the product-wide ACCESS_TOKEN_SECRET.
 */
export async function verifyServiceToken(
  token: string,
  secret: string,
): Promise<PlatformServiceIdentity> {
  // Clock-skew tolerance of 30s
  const jwtService = new JwtService({ secret })

  const payload = await jwtService.verifyAsync<ServiceTokenPayload>(token, {
    audience: REQUIRED_AUD,
    issuer: REQUIRED_ISS,
    clockTolerance: 30,
  })

  // Extra explicit check for aud in case the jwt library returns it as an array
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(REQUIRED_AUD)) {
    throw new Error('Invalid audience')
  }

  return {
    kind: 'service',
    callerId: payload.sub,
    tokenId: payload.jti,
  }
}

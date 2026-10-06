import { timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createCodeDigest } from './challenge-code'
import type { ChallengeVerificationInput, ChallengeVerificationOutcome, ChallengeVerificationRepository } from './challenge-verification.repository'

const MAX_ATTEMPTS = 5
const DUMMY_CODE = '00000000'

interface LockedClaim {
  id: string
  tenantId: string
  externalSource: string
  publisherId: string
  state: string
}

interface LockedChallenge {
  id: string
  tenantId: string
  publisherClaimId: string
  method: 'EMAIL' | 'LISTING'
  codeDigest: string
  attempts: number
  expiresAt: Date
  consumedAt: Date | null
}

export class PrismaChallengeVerificationRepository implements ChallengeVerificationRepository {
  constructor(private readonly secret: string) {}

  async validate(tx: Prisma.TransactionClient, input: ChallengeVerificationInput): Promise<ChallengeVerificationOutcome> {
    const claims = await tx.$queryRaw<LockedClaim[]>(Prisma.sql`
      SELECT "id", "tenantId", "externalSource", "publisherId", "state"
      FROM "publisher_claims"
      WHERE "id" = ${input.publisherClaimId}
        AND "tenantId" = ${input.tenantId}
        AND "externalSource" = 'ZONAPROP'
        AND "state" = 'PENDING'
      FOR UPDATE
    `)
    const claim = claims[0]
    if (!claim) return 'ineligible'

    const challenges = await tx.$queryRaw<LockedChallenge[]>(Prisma.sql`
      SELECT "id", "tenantId", "publisherClaimId", "method", "codeDigest", "attempts", "expiresAt", "consumedAt"
      FROM "publisher_claim_challenges"
      WHERE "id" = ${input.challengeId}
        AND "tenantId" = ${input.tenantId}
        AND "publisherClaimId" = ${claim.id}
      FOR UPDATE
    `)
    const challenge = challenges[0]
    if (!challenge) return 'ineligible'

    const [clock] = await tx.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT clock_timestamp() AS now`)
    if (!clock?.now) throw new Error('PostgreSQL did not return the challenge verification time')
    if (challenge.consumedAt || challenge.expiresAt <= clock.now || challenge.attempts >= MAX_ATTEMPTS) return 'ineligible'

    const wellFormed = /^\d{8}$/.test(input.code)
    const candidate = wellFormed ? input.code : DUMMY_CODE
    const expected = Buffer.from(createCodeDigest(this.secret, {
      tenantId: claim.tenantId,
      publisherId: claim.publisherId,
      challengeId: challenge.id,
      method: challenge.method,
      code: candidate,
    }), 'utf8')
    const stored = Buffer.from(challenge.codeDigest, 'utf8')
    const comparable = stored.length === expected.length ? stored : Buffer.alloc(expected.length)
    const matches = timingSafeEqual(expected, comparable) && stored.length === expected.length && wellFormed
    if (matches) return 'validated'

    const attempts = challenge.attempts + 1
    await tx.publisherClaimChallenge.update({
      where: { id: challenge.id },
      data: { attempts },
    })
    // This internal-only U4b4a1 helper has no trusted actor context. The production use-case in
    // U4b4a2 must supply the authenticated current actor for the accepted audit contract.
    await tx.publisherClaimEvent.create({ data: {
      tenantId: claim.tenantId,
      publisherClaimId: claim.id,
      eventType: 'publisher_challenge_attempt_failed',
      actorUserId: null,
      verificationMethod: challenge.method === 'EMAIL' ? 'EMAIL_CODE' : 'LISTING_CODE',
      reason: 'invalid_code',
      metadata: { attempt: attempts, maxAttempts: MAX_ATTEMPTS },
    } })
    return 'invalid'
  }
}

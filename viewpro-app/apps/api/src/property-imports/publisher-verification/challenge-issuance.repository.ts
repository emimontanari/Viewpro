export type ChallengeMethod = 'EMAIL' | 'LISTING'

export interface ChallengeIssuanceInput {
  tenantId: string
  publisherClaimId: string
  publisherId: string
  challengeId: string
  method: ChallengeMethod
  codeDigest: string
  recipientFingerprint: string
  ttlMs: number
}

export type ChallengeIssuanceResult =
  | { status: 'issued'; issuedAt: Date; expiresAt: Date }
  | { status: 'cooldown' | 'hourly-limit' }

export class PublisherClaimOwnershipError extends Error {
  constructor() {
    super('Publisher claim is not eligible for challenge issuance')
    this.name = 'PublisherClaimOwnershipError'
  }
}

export interface ChallengeIssuanceRepository {
  issue(input: ChallengeIssuanceInput): Promise<ChallengeIssuanceResult>
}

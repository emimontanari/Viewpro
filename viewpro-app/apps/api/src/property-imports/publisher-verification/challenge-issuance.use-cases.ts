import { randomUUID } from 'node:crypto'
import { createChallengeCode, createCodeDigest, createRecipientFingerprint } from './challenge-code'
import type { ChallengeIssuanceRepository, ChallengeMethod } from './challenge-issuance.repository'

const EMAIL_TTL_MS = 15 * 60_000
const LISTING_TTL_MS = 24 * 60 * 60_000

export interface IssuePublisherChallengeInput {
  tenantId: string
  publisherClaimId: string
  publisherId: string
  method: ChallengeMethod
  recipientAddress: string
}

export interface IssuedPublisherChallenge {
  challengeId: string
  method: ChallengeMethod
  code: string
  issuedAt: Date
  expiresAt: Date
}

export class PublisherChallengeRateLimitError extends Error {
  constructor() {
    super('Publisher challenge issuance is rate limited')
    this.name = 'PublisherChallengeRateLimitError'
  }
}

export class IssuePublisherChallengeUseCase {
  constructor(private readonly repository: ChallengeIssuanceRepository, private readonly hmacSecret: string | undefined) {}

  async execute(input: IssuePublisherChallengeInput): Promise<IssuedPublisherChallenge> {
    const challengeId = randomUUID()
    const code = createChallengeCode()
    const recipientFingerprint = createRecipientFingerprint(
      this.hmacSecret,
      input.tenantId,
      input.publisherId,
      input.recipientAddress,
    )
    const codeDigest = createCodeDigest(this.hmacSecret, {
      tenantId: input.tenantId,
      publisherId: input.publisherId,
      challengeId,
      method: input.method,
      code,
    })
    const result = await this.repository.issue({
      tenantId: input.tenantId,
      publisherClaimId: input.publisherClaimId,
      publisherId: input.publisherId,
      challengeId,
      method: input.method,
      codeDigest,
      recipientFingerprint,
      ttlMs: input.method === 'EMAIL' ? EMAIL_TTL_MS : LISTING_TTL_MS,
    })
    if (result.status !== 'issued') throw new PublisherChallengeRateLimitError()
    return { challengeId, method: input.method, code, issuedAt: result.issuedAt, expiresAt: result.expiresAt }
  }
}

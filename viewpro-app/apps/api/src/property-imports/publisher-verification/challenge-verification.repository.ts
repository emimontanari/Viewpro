import type { Prisma } from '@prisma/client'

export interface ChallengeVerificationInput {
  tenantId: string
  publisherClaimId: string
  challengeId: string
  code: string
}

/**
 * `validated` is only transaction-local control flow, not portable proof or approval authority.
 * The caller must retain this same open transaction and row locks through U4b4a2 consumption +
 * approval; never return this outcome or a derived proof token outside that transaction. This
 * U4b4a1 helper deliberately does not consume a valid challenge.
 */
export type ChallengeVerificationOutcome = 'validated' | 'invalid' | 'ineligible'

export interface ChallengeVerificationRepository {
  /** Must be called with the same caller-owned open transaction used for any subsequent action. */
  validate(tx: Prisma.TransactionClient, input: ChallengeVerificationInput): Promise<ChallengeVerificationOutcome>
}

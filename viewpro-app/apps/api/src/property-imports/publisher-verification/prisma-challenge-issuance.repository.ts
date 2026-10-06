import { Inject, Injectable } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import type { ChallengeIssuanceInput, ChallengeIssuanceRepository, ChallengeIssuanceResult } from './challenge-issuance.repository'
import { PublisherClaimOwnershipError } from './challenge-issuance.repository'
import { PrismaService } from '../../database/prisma.service'

const COOLDOWN_MS = 60_000
const HOURLY_WINDOW_MS = 60 * 60_000
const HOURLY_LIMIT = 3

@Injectable()
export class PrismaChallengeIssuanceRepository implements ChallengeIssuanceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  issue(input: ChallengeIssuanceInput): Promise<ChallengeIssuanceResult> {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.publisherClaim.findFirst({
        where: {
          id: input.publisherClaimId,
          tenantId: input.tenantId,
          externalSource: 'ZONAPROP',
          publisherId: input.publisherId,
        },
        select: { id: true },
      })
      if (!claim) throw new PublisherClaimOwnershipError()

      // This key is the stable tenant/publisher/recipient fingerprint, not claim or method.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.recipientFingerprint}, 0))`)

      // PostgreSQL transaction timestamps are fixed at transaction start. Snapshot wall time
      // only after the lock so queued issuances evaluate cooldown/window and expiry consistently.
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (!clock?.now) throw new Error('PostgreSQL did not return the challenge issuance time')
      const now = clock.now
      const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS)
      const hourCutoff = new Date(now.getTime() - HOURLY_WINDOW_MS)
      const recent = await tx.publisherClaimChallenge.aggregate({
        where: {
          tenantId: input.tenantId,
          recipientFingerprint: input.recipientFingerprint,
          issuedAt: { gt: hourCutoff },
        },
        _count: { _all: true },
        _max: { issuedAt: true },
      })
      if (recent._max.issuedAt && recent._max.issuedAt > cooldownCutoff) return { status: 'cooldown' }
      if (recent._count._all >= HOURLY_LIMIT) return { status: 'hourly-limit' }

      const expiresAt = new Date(now.getTime() + input.ttlMs)
      await tx.publisherClaimChallenge.create({
        data: {
          id: input.challengeId,
          tenantId: input.tenantId,
          publisherClaimId: input.publisherClaimId,
          method: input.method,
          codeDigest: input.codeDigest,
          recipientFingerprint: input.recipientFingerprint,
          issuedAt: now,
          expiresAt,
        },
      })
      return { status: 'issued', issuedAt: now, expiresAt }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  }
}

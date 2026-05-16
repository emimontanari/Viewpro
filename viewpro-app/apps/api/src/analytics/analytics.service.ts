import { Inject, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { ANALYTICS_REPOSITORY, type AnalyticsEventRecord, type AnalyticsRepository } from './analytics.repository'

const SENSITIVE_METADATA_KEYS = new Set([
  'email',
  'name',
  'address',
  'observation',
  'document',
  'token',
  'password',
  'secret',
  'credential',
])

export type TrackAnalyticsEventInput = Omit<Prisma.AnalyticsEventUncheckedCreateInput, 'id' | 'metadata'> & {
  metadata?: Prisma.InputJsonValue | null
}

export type TrackAnalyticsEventResult =
  | { status: 'persisted'; event: AnalyticsEventRecord }
  | { status: 'failed' }

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepository: AnalyticsRepository) {}

  async track(input: TrackAnalyticsEventInput): Promise<TrackAnalyticsEventResult> {
    try {
      const event = await this.analyticsRepository.create({
        ...input,
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        propertyEngagementId: input.propertyEngagementId ?? null,
        propertyAssetId: input.propertyAssetId ?? null,
        documentRequestId: input.documentRequestId ?? null,
        movementId: input.movementId ?? null,
        metadata: sanitizeAnalyticsMetadata(input.metadata) ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      })

      return { status: 'persisted', event }
    } catch {
      return { status: 'failed' }
    }
  }
}

export function sanitizeAnalyticsMetadata(metadata: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | null {
  if (metadata == null) {
    return null
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeAnalyticsMetadata(item)).filter((item) => item !== undefined) as Prisma.InputJsonArray
  }

  if (typeof metadata !== 'object') {
    return metadata
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key.toLowerCase()))
      .map(([key, value]) => [key, sanitizeAnalyticsMetadata(value)]),
  ) as Prisma.InputJsonObject
}

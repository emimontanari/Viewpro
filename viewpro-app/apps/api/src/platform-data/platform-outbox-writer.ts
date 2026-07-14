import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

type OutboxEventInput = {
  eventType: 'TENANT_STATUS_CHANGED'
  tenantId: string
  payload: {
    previousStatus: string
    newStatus: string
  }
  occurredAt: Date
}

/**
 * PlatformOutboxWriter — inserts one platform_outbox_events row using the
 * CALLER'S transaction client. The row commits iff the outer transaction commits.
 *
 * Design D3: called inside the SAME run(client) closure as the domain mutation.
 * Never opens a new connection; never swallows errors.
 */
@Injectable()
export class PlatformOutboxWriter {
  async emit(tx: Prisma.TransactionClient, event: OutboxEventInput): Promise<void> {
    await tx.platformOutboxEvent.create({
      data: event,
    })
  }
}

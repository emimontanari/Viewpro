import type { OwnerEngagementRecord } from '../owner-portal.repository'

export type OwnerEngagementResponse = ReturnType<typeof mapOwnerEngagement>

export function mapOwnerEngagement(engagement: OwnerEngagementRecord) {
  return {
    id: engagement.id,
    tenant: {
      id: engagement.tenant.id,
      name: engagement.tenant.name,
    },
    operationType: engagement.operationType,
    status: engagement.status,
    publishedPriceCents: engagement.publishedPriceCents,
    currency: engagement.currency,
    agents: engagement.agents.map((agent) => ({
      userId: agent.agentUserId,
      firstName: agent.agentUser.firstName,
      email: agent.agentUser.email,
    })),
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
  }
}

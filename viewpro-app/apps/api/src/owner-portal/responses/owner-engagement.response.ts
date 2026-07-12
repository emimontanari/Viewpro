import type { OwnerEngagementRecord } from '../owner-portal.repository'
import { mapTenantWhatsappContact, type OwnerPropertyContactResponse } from '../owner-whatsapp-contact'

export type OwnerEngagementResponse = ReturnType<typeof mapOwnerEngagement>
export type { OwnerPropertyContactResponse }

export function mapOwnerEngagement(engagement: OwnerEngagementRecord) {
  return {
    id: engagement.id,
    tenant: {
      id: engagement.tenant.id,
      name: engagement.tenant.name,
    },
    contact: mapTenantWhatsappContact(engagement.tenant.whatsappPhone),
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

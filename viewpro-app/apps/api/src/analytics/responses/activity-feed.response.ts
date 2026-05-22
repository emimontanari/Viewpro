import type { ActivityMovementWithRelations } from "../../movements/movements.repository";

export type ActivityFeedItemResponse = ReturnType<
	typeof mapActivityFeedMovement
>;

export function mapActivityFeedMovement(
	movement: ActivityMovementWithRelations,
) {
	const engagement = movement.propertyEngagement;
	const propertyAsset = engagement.propertyAsset;

	return {
		id: movement.id,
		tenantId: movement.tenantId,
		propertyEngagementId: movement.propertyEngagementId,
		type: movement.type,
		observation: movement.observation,
		nextStep: movement.nextStep,
		previousStatus: movement.previousStatus,
		newStatus: movement.newStatus,
		source: movement.source,
		interestCount: movement.interestCount,
		visitCount: movement.visitCount,
		offerAmountCents: movement.offerAmountCents,
		interestLevel: movement.interestLevel,
		createdBy: {
			id: movement.createdBy.id,
			email: movement.createdBy.email,
			firstName: movement.createdBy.firstName,
		},
		createdAt: movement.createdAt.toISOString(),
		property: {
			id: engagement.id,
			engagementId: engagement.id,
			assetId: engagement.propertyAssetId,
			title: propertyAsset.title,
			addressLine: propertyAsset.addressLine,
			city: propertyAsset.city,
			province: propertyAsset.province,
			operationType: engagement.operationType,
			status: engagement.status,
			agents: engagement.agents.map((agent) => ({
				id: agent.id,
				userId: agent.agentUserId,
				email: agent.agentUser.email,
				firstName: agent.agentUser.firstName,
			})),
		},
	};
}

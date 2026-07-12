import type { ActivityDocumentRequestRecord } from "../../documents/documents.repository";
import type { ActivityMovementWithRelations } from "../../movements/movements.repository";

export type ActivityMovementItemResponse = ReturnType<
	typeof mapActivityFeedMovement
>;
export type ActivityDocumentRequestItemResponse = ReturnType<
	typeof mapActivityFeedDocumentRequest
>;
export type ActivityFeedItemResponse =
	| ActivityMovementItemResponse
	| ActivityDocumentRequestItemResponse;

export function mapActivityFeedMovement(
	movement: ActivityMovementWithRelations,
) {
	const engagement = movement.propertyEngagement;
	const propertyAsset = engagement.propertyAsset;

	return {
		kind: "movement" as const,
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

export function mapActivityFeedDocumentRequest(
	request: ActivityDocumentRequestRecord,
) {
	const engagement = request.propertyEngagement;
	const propertyAsset = engagement.propertyAsset;
	const owner = request.propertyAssetOwner;
	const currentVersion = request.document?.currentVersion ?? null;

	return {
		kind: "document_request" as const,
		id: `document-request:${request.id}`,
		tenantId: request.tenantId,
		propertyEngagementId: request.propertyEngagementId,
		documentRequestId: request.id,
		createdAt: request.createdAt.toISOString(),
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
		owner: owner
			? {
					id: owner.id,
					email: owner.ownerEmail,
					firstName: null,
					lastName: null,
					ownerFirstName: owner.ownerFirstName,
					ownerLastName: owner.ownerLastName,
					accessStatus: owner.accessStatus,
				}
			: null,
		requestedBy: {
			id: request.requestedByUser.id,
			email: request.requestedByUser.email,
			firstName: request.requestedByUser.firstName,
		},
		documentRequest: {
			title: request.title,
			description: request.description,
			status: request.status,
			currentVersion: currentVersion
				? {
						id: currentVersion.id,
						originalFilename: currentVersion.originalFilename,
						status: currentVersion.status,
						createdAt: currentVersion.createdAt.toISOString(),
					}
				: null,
		},
	};
}

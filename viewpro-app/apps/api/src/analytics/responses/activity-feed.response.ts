import type { ActivityDocumentRequestRecord } from "../../documents/documents.repository";
import type { MembershipActivityRecord } from "../../memberships/membership-activity.repository";
import type { ActivityMovementWithRelations } from "../../movements/movements.repository";

/**
 * PropertyImageDto — operator-activity-media (Slice 1) design D1/D2.
 *
 * `url` is pre-built (via `buildPropertyImageUrl`, an env-dependent
 * concern) by the ONLY caller that populates the images map
 * (`GetPlatformTenantActivityUseCase`) BEFORE it reaches these pure
 * mappers — mappers never touch env/storage config.
 */
export type PropertyImageDto = {
	id: string;
	url: string;
	isPrimary: boolean;
	originalFilename: string;
};

export type ActivityMovementItemResponse = ReturnType<
	typeof mapActivityFeedMovement
>;
export type ActivityDocumentRequestItemResponse = ReturnType<
	typeof mapActivityFeedDocumentRequest
>;
export type ActivityMembershipItemResponse = ReturnType<
	typeof mapActivityFeedMembership
>;
export type ActivityFeedItemResponse =
	| ActivityMovementItemResponse
	| ActivityDocumentRequestItemResponse
	| ActivityMembershipItemResponse;

export function mapActivityFeedMovement(
	movement: ActivityMovementWithRelations,
	imagesByAssetId?: ReadonlyMap<string, PropertyImageDto[]>,
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
			images: imagesByAssetId?.get(engagement.propertyAssetId) ?? [],
		},
	};
}

export function mapActivityFeedDocumentRequest(
	request: ActivityDocumentRequestRecord,
	imagesByAssetId?: ReadonlyMap<string, PropertyImageDto[]>,
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
			images: imagesByAssetId?.get(engagement.propertyAssetId) ?? [],
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

/**
 * mapActivityFeedMembership — maps a derived membership lifecycle record
 * (INVITED/JOINED/DEACTIVATED, `memberships/membership-activity.repository.ts`)
 * into the merged activity feed's item shape.
 *
 * One `kind: 'membership'` value, sub-discriminated by `membershipEvent` —
 * mirrors how `movement.type` sub-discriminates within `kind: 'movement'`
 * (design D1). `subject` is who the event is about; `actor` is who performed
 * it, or `null` when there is none to show (JOINED has no actor — D1c
 * deliberately rejects an invited-by heuristic in favor of the sibling
 * INVITED event's real FK).
 *
 * The globally-unique `membership-{invited,joined,deactivated}:` id prefix
 * is applied HERE, not in the repository — required by `compareActivityItems`'
 * `id.localeCompare` tie-break, same discipline as the `document-request:`
 * prefix above.
 */
export function mapActivityFeedMembership(record: MembershipActivityRecord) {
	const base = {
		kind: "membership" as const,
		tenantId: record.tenantId,
		createdAt: record.createdAt.toISOString(),
	};

	switch (record.event) {
		case "INVITED":
			return {
				...base,
				id: `membership-invited:${record.id}`,
				membershipEvent: "INVITED" as const,
				subject: { email: record.email, firstName: null },
				actor: {
					id: record.invitedByUser.id,
					email: record.invitedByUser.email,
					firstName: record.invitedByUser.firstName,
				},
			};
		case "JOINED":
			return {
				...base,
				id: `membership-joined:${record.id}`,
				membershipEvent: "JOINED" as const,
				subject: {
					id: record.user.id,
					email: record.user.email,
					firstName: record.user.firstName,
				},
				actor: null,
			};
		case "DEACTIVATED":
			return {
				...base,
				id: `membership-deactivated:${record.id}`,
				membershipEvent: "DEACTIVATED" as const,
				subject: {
					id: record.user.id,
					email: record.user.email,
					firstName: record.user.firstName,
				},
				actor: record.deactivatedByUser
					? {
							id: record.deactivatedByUser.id,
							email: record.deactivatedByUser.email,
							firstName: record.deactivatedByUser.firstName,
						}
					: null,
			};
		case "ROLE_CHANGED":
			// id prefix is `member-role-changed:` (singular `member-`, NOT
			// `membership-`) — matches the proposal verbatim, deliberately
			// breaking the sibling prefix's naming symmetry. Zero functional
			// impact: compareActivityItems only needs id.localeCompare stability,
			// not a shared root string.
			return {
				...base,
				id: `member-role-changed:${record.id}`,
				membershipEvent: "ROLE_CHANGED" as const,
				subject: record.subject,
				actor: record.actor,
				previousRole: record.previousRole,
				newRole: record.newRole,
			};
	}
}

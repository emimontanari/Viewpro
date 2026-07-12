import type { OwnerMovementRecord } from "../owner-portal.repository";
import { mapAssignedSellerWhatsappContact } from "../owner-whatsapp-contact";

export type OwnerMovementResponse = ReturnType<typeof mapOwnerMovement>;

export function mapOwnerMovement(movement: OwnerMovementRecord) {
	return {
		id: movement.id,
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
		contact: mapAssignedSellerWhatsappContact(movement.propertyEngagement.agents),
		createdAt: movement.createdAt.toISOString(),
	};
}

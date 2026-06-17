import { isValidWhatsappPhone } from "../common/whatsapp/whatsapp-phone.utils";

export type OwnerPropertyContactResponse = {
	available: boolean;
	targetType: "tenant";
	displayLabel: string;
	whatsappPhone?: string;
};

export type OwnerMovementContactResponse = {
	available: boolean;
	targetType: "assigned_seller";
	displayLabel: string;
	whatsappPhone?: string;
};

export type AssignedSellerAgent = {
	agentUserId: string;
	assignedAt: Date;
	agentUser: { whatsappPhone: string | null };
};

export function mapTenantWhatsappContact(
	whatsappPhone: string | null,
): OwnerPropertyContactResponse {
	// isValidWhatsappPhone(null) returns true (clear-value semantics for the
	// tenant editor). Owner-portal read path treats null/blank as "no contact",
	// so handle null explicitly before delegating to the shared validator.
	if (whatsappPhone === null || !isValidWhatsappPhone(whatsappPhone)) {
		return unavailableTenantContact();
	}

	return {
		available: true,
		targetType: "tenant",
		displayLabel: "Contactar inmobiliaria",
		whatsappPhone,
	};
}

export function mapAssignedSellerWhatsappContact(
	agents: AssignedSellerAgent[],
): OwnerMovementContactResponse {
	if (!agents || agents.length === 0) {
		return unavailableAssignedSellerContact();
	}

	// SQL-side orderBy [assignedAt asc, agentUserId asc] ensures agents[0] is the winner.
	const seller = agents[0];

	if (!seller) {
		return unavailableAssignedSellerContact();
	}

	const phone = seller.agentUser.whatsappPhone;

	// Same null-explicit guard as mapTenantWhatsappContact: isValidWhatsappPhone(null)
	// returns true by design, but the assigned-seller read path treats null as
	// "no contact configured". Rule check itself comes from the shared util.
	if (phone === null || !isValidWhatsappPhone(phone)) {
		return unavailableAssignedSellerContact();
	}

	return {
		available: true,
		targetType: "assigned_seller",
		displayLabel: "Consultar responsable",
		whatsappPhone: phone,
	};
}

function unavailableTenantContact(): OwnerPropertyContactResponse {
	return {
		available: false,
		targetType: "tenant",
		displayLabel: "Contacto no configurado",
	};
}

function unavailableAssignedSellerContact(): OwnerMovementContactResponse {
	return {
		available: false,
		targetType: "assigned_seller",
		displayLabel: "Contacto no configurado",
	};
}

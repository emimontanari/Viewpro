import { MIN_WHATSAPP_DIGITS } from "../common/whatsapp/whatsapp-phone.utils";

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
	if (!whatsappPhone) {
		return unavailableTenantContact();
	}

	const digits = whatsappPhone.replace(/\D/g, "");

	if (digits.length < MIN_WHATSAPP_DIGITS) {
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

	if (!seller.agentUser.whatsappPhone) {
		return unavailableAssignedSellerContact();
	}

	const digits = seller.agentUser.whatsappPhone.replace(/\D/g, "");

	if (digits.length < MIN_WHATSAPP_DIGITS) {
		return unavailableAssignedSellerContact();
	}

	return {
		available: true,
		targetType: "assigned_seller",
		displayLabel: "Consultar responsable",
		whatsappPhone: seller.agentUser.whatsappPhone,
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

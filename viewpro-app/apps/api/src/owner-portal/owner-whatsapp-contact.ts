import { isValidWhatsappPhone } from "../common/whatsapp/whatsapp-phone.utils";
import type { OwnerPrimarySellerContactCandidate } from "./owner-portal.repository";

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
	candidate: OwnerPrimarySellerContactCandidate | null,
): OwnerMovementContactResponse {
	const phone = candidate?.agentUser.whatsappPhone;

	// Same null-explicit guard as mapTenantWhatsappContact: isValidWhatsappPhone(null)
	// returns true by design, but the assigned-seller read path treats null as
	// "no contact configured". Rule check itself comes from the shared util.
	if (phone === null || phone === undefined || !isValidWhatsappPhone(phone)) {
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

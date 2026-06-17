import { MIN_WHATSAPP_DIGITS } from "../common/whatsapp/whatsapp-phone.utils";

export type OwnerPropertyContactResponse = {
	available: boolean;
	targetType: "tenant";
	displayLabel: string;
	whatsappPhone?: string;
};

export type OwnerMovementContactResponse = {
	available: boolean;
	targetType: "movement_author";
	displayLabel: string;
	whatsappPhone?: string;
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

export function mapMovementAuthorWhatsappContact(
	whatsappPhone: string | null,
): OwnerMovementContactResponse {
	if (!whatsappPhone) {
		return unavailableMovementAuthorContact();
	}

	const digits = whatsappPhone.replace(/\D/g, "");

	if (digits.length < MIN_WHATSAPP_DIGITS) {
		return unavailableMovementAuthorContact();
	}

	return {
		available: true,
		targetType: "movement_author",
		displayLabel: "Consultar responsable",
		whatsappPhone,
	};
}

function unavailableTenantContact(): OwnerPropertyContactResponse {
	return {
		available: false,
		targetType: "tenant",
		displayLabel: "Contacto no configurado",
	};
}

function unavailableMovementAuthorContact(): OwnerMovementContactResponse {
	return {
		available: false,
		targetType: "movement_author",
		displayLabel: "Contacto no configurado",
	};
}

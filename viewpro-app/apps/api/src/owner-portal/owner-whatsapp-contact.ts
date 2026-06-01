export type OwnerPropertyContactResponse = {
	available: boolean;
	targetType: "tenant";
	displayLabel: string;
	whatsappPhone?: string;
};

const MIN_WHATSAPP_DIGITS = 8;

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

function unavailableTenantContact(): OwnerPropertyContactResponse {
	return {
		available: false,
		targetType: "tenant",
		displayLabel: "Contacto no configurado",
	};
}

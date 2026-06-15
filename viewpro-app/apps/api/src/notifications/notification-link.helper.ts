const SAFE_INTERNAL_LINKS = new Set([
	"/dashboard",
	"/dashboard/seguimiento",
	"/dashboard/users",
	"/dashboard/status-change-requests", // Stage 20.10 — manager bandeja link
]);

export function sanitizeInternalNotificationLink(input: {
	linkHref?: string | null;
	propertyEngagementId?: string | null;
}): string | null {
	const linkHref = input.linkHref;
	if (!linkHref || !linkHref.startsWith("/")) {
		return null;
	}

	if (SAFE_INTERNAL_LINKS.has(linkHref)) {
		return linkHref;
	}

	if (!input.propertyEngagementId) {
		return null;
	}

	const expectedProductLink = `/dashboard/product/${input.propertyEngagementId}`;
	if (linkHref === expectedProductLink) {
		return linkHref;
	}

	return null;
}

export function sanitizeOwnerNotificationLink(input: {
	linkHref?: string | null;
	propertyAssetId?: string | null;
}): string | null {
	const linkHref = input.linkHref;
	if (!linkHref || !linkHref.startsWith("/")) {
		return null;
	}

	if (linkHref === "/owner") {
		return linkHref;
	}

	if (!input.propertyAssetId) {
		return null;
	}

	const expectedPropertyLink = `/owner/properties/${input.propertyAssetId}`;
	if (linkHref === expectedPropertyLink) {
		return linkHref;
	}

	return null;
}

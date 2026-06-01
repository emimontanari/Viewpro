const SAFE_INTERNAL_LINKS = new Set([
	"/dashboard",
	"/dashboard/seguimiento",
	"/dashboard/users",
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

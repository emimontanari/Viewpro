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

const ALLOWED_OWNER_QUERY_PARAM_NAMES = new Set(['tab', 'doc']);

export function sanitizeOwnerNotificationLink(input: {
	linkHref?: string | null;
	propertyAssetId?: string | null;
}): string | null {
	const linkHref = input.linkHref;

	// Reject falsy, protocol-relative (//host), and absolute URLs up front.
	if (!linkHref || !linkHref.startsWith('/')) {
		return null;
	}

	// Fast-path: /owner root (no trailing slash, no query params).
	if (linkHref === '/owner') {
		return linkHref;
	}

	if (!input.propertyAssetId) {
		return null;
	}

	// Fast-path: param-less /owner/properties/{assetId} (FR-S3 — historical notifications).
	const expectedParamlessPath = `/owner/properties/${input.propertyAssetId}`;
	if (linkHref === expectedParamlessPath) {
		return linkHref;
	}

	// Deep-link path: parse with a fixed base so relative inputs cannot escape the origin.
	let url: URL;
	try {
		url = new URL(linkHref, 'https://viewpro.local');
	} catch {
		return null;
	}

	// Origin assertion — catches //host, backslash tricks, and any absolute URL.
	if (url.origin !== 'https://viewpro.local') {
		return null;
	}

	// Pathname must exactly match the trusted column — no path-traversal can produce a false match
	// because URL() normalises `.`/`..`/`%2e` before the comparison (D1 step 4).
	if (url.pathname !== expectedParamlessPath) {
		return null;
	}

	// Closed allowlist: iterate all param names; reject on the first unknown key or duplicate (D1 step 5).
	for (const key of url.searchParams.keys()) {
		if (!ALLOWED_OWNER_QUERY_PARAM_NAMES.has(key)) {
			return null;
		}
	}
	for (const key of ALLOWED_OWNER_QUERY_PARAM_NAMES) {
		if (url.searchParams.getAll(key).length > 1) {
			return null;
		}
	}

	// tab value must be exactly "documents" (FR-S6).
	if (url.searchParams.get('tab') !== 'documents') {
		return null;
	}

	// Both tab=documents AND a NON-EMPTY doc must be present together (FR-S10, D1 step 5).
	const docValue = url.searchParams.get('doc');
	if (!docValue) {
		return null;
	}

	// Reject any URL fragment (D1 step 6).
	if (url.hash !== '') {
		return null;
	}

	// Return canonical path+search (param order from searchParams, no fragment).
	return `${url.pathname}${url.search}`;
}

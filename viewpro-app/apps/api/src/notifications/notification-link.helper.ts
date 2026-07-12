const SAFE_INTERNAL_LINKS = new Set([
	"/dashboard",
	"/dashboard/seguimiento",
	"/dashboard/users",
	"/dashboard/status-change-requests", // Stage 20.10 — manager bandeja link
]);

// Closed {doc}-only allowlist for the internal product page. The internal page
// is NOT tabbed (PropertyDocumentRequests is mounted inline, not behind ?tab=).
// `tab` is intentionally absent — adding it here requires a separate spec change.
const ALLOWED_INTERNAL_QUERY_PARAM_NAMES = new Set(["doc"]);

export function sanitizeInternalNotificationLink(input: {
	linkHref?: string | null;
	propertyEngagementId?: string | null;
}): string | null {
	const linkHref = input.linkHref;

	// Step 1 (unchanged): reject falsy, protocol-relative (//host), and absolute URLs up front.
	if (!linkHref || !linkHref.startsWith("/")) {
		return null;
	}

	// Step 2 (unchanged): exact-string fast-path for the four static dashboard links.
	// MUST run BEFORE the parse branch — these are query-less and would fail the
	// expectedProductLink pathname match below.
	if (SAFE_INTERNAL_LINKS.has(linkHref)) {
		return linkHref;
	}

	// Step 3 (unchanged): no engagement context → only remaining accept paths are impossible.
	if (!input.propertyEngagementId) {
		return null;
	}

	// Step 4 (unchanged, FAST-PATH): param-less product path (historical notifications, FR-S3).
	// MUST run BEFORE the parse branch for performance and simplicity.
	const expectedProductLink = `/dashboard/product/${input.propertyEngagementId}`;
	if (linkHref === expectedProductLink) {
		return linkHref;
	}

	// Step 5 (NEW — parse branch): only reached by a link with a query or fragment.
	// Any input reaching here failed the exact param-less equality above, meaning it
	// carries a query string, a fragment, or both.

	// 5a. Parse with a fixed base so relative inputs cannot escape the origin.
	let url: URL;
	try {
		url = new URL(linkHref, "https://viewpro.local");
	} catch {
		return null;
	}

	// 5b. Origin assertion — catches //host, backslash tricks, any absolute URL.
	if (url.origin !== "https://viewpro.local") {
		return null;
	}

	// 5c. Pathname must exactly match the trusted DB column value. URL() normalises
	// `.`/`..`/`%2e` so no traversal or encoded segment can forge a match.
	if (url.pathname !== expectedProductLink) {
		return null;
	}

	// 5d. Closed NAME allowlist: reject on the first unknown key.
	// `tab` is NOT in this set — the internal page is not tabbed.
	for (const key of url.searchParams.keys()) {
		if (!ALLOWED_INTERNAL_QUERY_PARAM_NAMES.has(key)) {
			return null;
		}
	}

	// 5e. Reject duplicate `doc` param (HTTP param pollution guard).
	if (url.searchParams.getAll("doc").length > 1) {
		return null;
	}

	// 5f. Require a non-empty `doc` value.
	const docValue = url.searchParams.get("doc");
	if (!docValue) {
		return null;
	}

	// 5g. Reject any URL fragment.
	if (url.hash !== "") {
		return null;
	}

	// 5h. Return canonical path+search (param order from searchParams, no fragment).
	return `${url.pathname}${url.search}`;
}

const ALLOWED_OWNER_QUERY_PARAM_NAMES = new Set(['tab', 'doc', 'movement']);

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

	// Two-tab dispatch (D2, FR-S2): exactly two ACCEPT shapes; any other tab value → reject.
	const tab = url.searchParams.get('tab');
	const docValue = url.searchParams.get('doc');
	const movementValue = url.searchParams.get('movement');

	if (tab === 'documents') {
		// 24.6a path: require non-empty doc AND movement absent.
		if (!docValue || movementValue !== null) return null;
	} else if (tab === 'tracking') {
		// 24.6c path: require non-empty movement AND doc absent.
		if (!movementValue || docValue !== null) return null;
	} else {
		// Any other tab value, or tab absent → reject.
		return null;
	}

	// Reject any URL fragment (D1 step 6).
	if (url.hash !== '') {
		return null;
	}

	// Return canonical path+search (param order from searchParams, no fragment).
	return `${url.pathname}${url.search}`;
}

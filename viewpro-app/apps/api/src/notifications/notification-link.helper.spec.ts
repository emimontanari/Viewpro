import { describe, expect, it } from 'vitest';
import {
	sanitizeInternalNotificationLink,
	sanitizeOwnerNotificationLink,
} from './notification-link.helper';

const ASSET_ID = 'asset-abc';
const call = (linkHref: unknown) =>
	sanitizeOwnerNotificationLink({
		linkHref: linkHref as string | null | undefined,
		propertyAssetId: ASSET_ID,
	});

// ---------------------------------------------------------------------------
// Acceptance cases — S-S1..S-S4
// ---------------------------------------------------------------------------
describe('sanitizeOwnerNotificationLink — acceptance cases', () => {
	// S-S1 — FR-S2 regression guard: /owner root
	it('S-S1: returns /owner unchanged (regression guard)', () => {
		expect(call('/owner')).toBe('/owner');
	});

	// S-S2 — FR-S3 regression guard: param-less property path
	it('S-S2: returns param-less /owner/properties/{assetId} unchanged (regression guard)', () => {
		expect(call('/owner/properties/asset-abc')).toBe('/owner/properties/asset-abc');
	});

	// S-S3 — FR-S4 core new acceptance case: full deep-link
	it('S-S3: accepts full deep-link ?tab=documents&doc=req-123', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123')).toBe(
			'/owner/properties/asset-abc?tab=documents&doc=req-123',
		);
	});

	// S-S4 — FR-S4 param-order must NOT matter
	it('S-S4: accepts deep-link with doc and tab in reversed order', () => {
		const result = call('/owner/properties/asset-abc?doc=req-123&tab=documents');
		expect(result).not.toBeNull();
		expect(result).toContain('tab=documents');
		expect(result).toContain('doc=req-123');
	});
});

// ---------------------------------------------------------------------------
// Rejection cases — S-S5..S-S16, fragment, duplicate doc
// ---------------------------------------------------------------------------
describe('sanitizeOwnerNotificationLink — rejection cases (SECURITY-CRITICAL)', () => {
	// S-S5 — FR-S5: unknown param → null
	it('S-S5: rejects unknown param (evil=x) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123&evil=x')).toBeNull();
	});

	// S-S6 — FR-S5: open redirect param → null
	it('S-S6: rejects redirect param → null', () => {
		expect(call('/owner/properties/asset-abc?redirect=http://evil.com')).toBeNull();
	});

	// S-S7 — FR-S6: wrong tab value → null
	it('S-S7: rejects tab=tracking with doc → null', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking&doc=req-123')).toBeNull();
	});

	// S-S8 — FR-S10: doc alone (no tab) → null
	it('S-S8: rejects doc alone without tab → null', () => {
		expect(call('/owner/properties/asset-abc?doc=req-123')).toBeNull();
	});

	// S-S9 — FR-S7: protocol-relative → null
	it('S-S9: rejects protocol-relative URL → null', () => {
		expect(call('//evil.example.com/owner/properties/asset-abc')).toBeNull();
	});

	// S-S10 — FR-S7: absolute URL → null
	it('S-S10: rejects absolute URL with scheme → null', () => {
		expect(call('https://evil.example.com/owner/properties/asset-abc')).toBeNull();
	});

	// S-S11 — FR-S8: non-owner pathname → null
	it('S-S11: rejects /dashboard/product/engagement-id → null', () => {
		expect(call('/dashboard/product/engagement-id')).toBeNull();
	});

	// S-S12 — FR-S9: empty assetId segment → null
	it('S-S12: rejects /owner/properties/ (empty assetId) → null', () => {
		expect(call('/owner/properties/')).toBeNull();
	});

	// S-S13 — FR-S9: path traversal → null
	it('S-S13: rejects /owner/properties/../etc/passwd → null', () => {
		expect(call('/owner/properties/../etc/passwd')).toBeNull();
	});

	// S-S14 — empty string → null
	it('S-S14: rejects empty string → null', () => {
		expect(call('')).toBeNull();
	});

	// S-S15 (null) — null input → null (no throw)
	it('S-S15 (null): returns null for null input without throwing', () => {
		expect(call(null)).toBeNull();
	});

	// S-S15 (undefined) — undefined input → null (no throw)
	it('S-S15 (undefined): returns null for undefined input without throwing', () => {
		expect(call(undefined)).toBeNull();
	});

	// S-S16 — FR-S10: tab alone (without doc) → null
	it('S-S16: rejects ?tab=documents alone (without doc) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents')).toBeNull();
	});

	// FR-S10 / D1 step 5 — empty doc value → null (doc= present but blank)
	it('rejects ?tab=documents&doc= (empty doc value) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=')).toBeNull();
	});

	// Fragment rejection — D1 step 6
	it('rejects any URL fragment → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123#evil')).toBeNull();
	});

	// Duplicate doc param — D1 step 5
	it('rejects duplicate doc param → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=documents&doc=req-123&doc=req-456'),
		).toBeNull();
	});

	// Tampered assetId in link — D1 step 4
	it('rejects tampered assetId (OTHER-ASSET) when propertyAssetId is asset-abc → null', () => {
		expect(
			sanitizeOwnerNotificationLink({
				linkHref: '/owner/properties/OTHER-ASSET?tab=documents&doc=req-123',
				propertyAssetId: 'asset-abc',
			}),
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// sanitizeOwnerNotificationLink — 24.6c two-tab dispatch matrix
// ---------------------------------------------------------------------------
// Tests S-S1..S-S31 per spec. Written BEFORE the implementation (TDD RED).
// The helper `call` above uses ASSET_ID='asset-abc'.
// ---------------------------------------------------------------------------

// 2a — ACCEPT cases (S-S1..S-S4)
describe('sanitizeOwnerNotificationLink — 24.6c two-tab dispatch — ACCEPT cases', () => {
	// S-S1 — FR-S4: 24.6a regression guard — tab=documents+doc MUST survive the dispatch rewrite
	it('S-S1 (24.6a regression): accepts ?tab=documents&doc=req-123 unchanged', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123')).toBe(
			'/owner/properties/asset-abc?tab=documents&doc=req-123',
		);
	});

	// S-S2 — FR-S4: UUID-format doc value (real-world regression guard)
	it('S-S2 (24.6a UUID doc): accepts ?tab=documents&doc=550e8400-e29b-41d4-a716-446655440000', () => {
		const result = call(
			'/owner/properties/asset-abc?tab=documents&doc=550e8400-e29b-41d4-a716-446655440000',
		);
		expect(result).not.toBeNull();
		expect(result).toContain('tab=documents');
		expect(result).toContain('doc=550e8400-e29b-41d4-a716-446655440000');
	});

	// S-S3 — FR-S5: PRIMARY new 24.6c accept case
	it('S-S3 (24.6c primary): accepts ?tab=tracking&movement=mov-123', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking&movement=mov-123')).toBe(
			'/owner/properties/asset-abc?tab=tracking&movement=mov-123',
		);
	});

	// S-S4 — FR-S5: UUID-format movement value
	it('S-S4 (24.6c UUID movement): accepts ?tab=tracking&movement=550e8400-e29b-41d4-a716-446655440000', () => {
		const result = call(
			'/owner/properties/asset-abc?tab=tracking&movement=550e8400-e29b-41d4-a716-446655440000',
		);
		expect(result).not.toBeNull();
		expect(result).toContain('tab=tracking');
		expect(result).toContain('movement=550e8400-e29b-41d4-a716-446655440000');
	});
});

// 2b — REJECT: per-tab missing secondary (S-S5..S-S6)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: missing secondary', () => {
	// S-S5 — FR-S2/FR-S3: tab=documents without doc → null
	it('S-S5: rejects ?tab=documents (no doc) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents')).toBeNull();
	});

	// S-S6 — FR-S2/FR-S3: tab=tracking without movement → null
	it('S-S6: rejects ?tab=tracking (no movement) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking')).toBeNull();
	});
});

// 2c — REJECT: empty secondary value (S-S7..S-S8)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: empty secondary value', () => {
	// S-S7 — FR-S6: empty doc value
	it('S-S7: rejects ?tab=documents&doc= (empty doc) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=')).toBeNull();
	});

	// S-S8 — FR-S6: empty movement value
	it('S-S8: rejects ?tab=tracking&movement= (empty movement) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking&movement=')).toBeNull();
	});
});

// 2d — REJECT: cross-tab contamination (S-S9..S-S10)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: cross-tab contamination', () => {
	// S-S9 — FR-S2/FR-S3: tab=documents + movement (no doc)
	it('S-S9: rejects ?tab=documents&movement=mov-123 (movement not valid for documents tab) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&movement=mov-123')).toBeNull();
	});

	// S-S10 — FR-S2/FR-S3: tab=tracking + doc (no movement)
	it('S-S10: rejects ?tab=tracking&doc=req-123 (doc not valid for tracking tab) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking&doc=req-123')).toBeNull();
	});
});

// 2e — REJECT: both secondary params present (S-S11..S-S12)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: both secondaries present', () => {
	// S-S11 — FR-S1/FR-S3: tab=documents + doc + movement → null
	it('S-S11: rejects ?tab=documents&doc=req-123&movement=mov-456 (both secondaries) → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=documents&doc=req-123&movement=mov-456'),
		).toBeNull();
	});

	// S-S12 — FR-S1/FR-S3: tab=tracking + movement + doc → null
	it('S-S12: rejects ?tab=tracking&movement=mov-123&doc=req-456 (both secondaries) → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=tracking&movement=mov-123&doc=req-456'),
		).toBeNull();
	});
});

// 2f — REJECT: secondary without paired tab (S-S13..S-S14)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: secondary without tab', () => {
	// S-S13 — FR-S8: doc only, no tab
	it('S-S13: rejects ?doc=req-123 (no tab) → null', () => {
		expect(call('/owner/properties/asset-abc?doc=req-123')).toBeNull();
	});

	// S-S14 — FR-S8: movement only, no tab
	it('S-S14: rejects ?movement=mov-123 (no tab) → null', () => {
		expect(call('/owner/properties/asset-abc?movement=mov-123')).toBeNull();
	});
});

// 2g — REJECT: unrecognized tab value (S-S15..S-S16)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: unrecognized tab value', () => {
	// S-S15 — FR-S7: tab=summary
	it('S-S15: rejects ?tab=summary → null', () => {
		expect(call('/owner/properties/asset-abc?tab=summary')).toBeNull();
	});

	// S-S16 — FR-S7: tab=info
	it('S-S16: rejects ?tab=info → null', () => {
		expect(call('/owner/properties/asset-abc?tab=info')).toBeNull();
	});
});

// 2h — REJECT: non-allowlisted param (S-S17..S-S18)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: non-allowlisted param', () => {
	// S-S17 — FR-S1: unknown param alongside valid combo
	it('S-S17: rejects ?tab=tracking&movement=mov-123&evil=x (unknown param) → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=tracking&movement=mov-123&evil=x'),
		).toBeNull();
	});

	// S-S18 — FR-S1: open redirect param
	it('S-S18: rejects ?tab=tracking&movement=mov-123&redirect=http://evil.com → null', () => {
		expect(
			call(
				'/owner/properties/asset-abc?tab=tracking&movement=mov-123&redirect=http://evil.com',
			),
		).toBeNull();
	});
});

// 2i — REJECT: existing structural guards (S-S19..S-S29)
describe('sanitizeOwnerNotificationLink — 24.6c — REJECT: structural guards (unchanged)', () => {
	// S-S19 — FR-S13: protocol-relative URL
	it('S-S19: rejects protocol-relative URL //evil.example.com/... → null', () => {
		expect(call('//evil.example.com/owner/properties/asset-abc')).toBeNull();
	});

	// S-S20 — FR-S13: absolute URL with scheme
	it('S-S20: rejects absolute URL https://evil.example.com/...?tab=tracking&movement=mov-1 → null', () => {
		expect(
			call(
				'https://evil.example.com/owner/properties/asset-abc?tab=tracking&movement=mov-1',
			),
		).toBeNull();
	});

	// S-S21 — FR-S14: path traversal
	it('S-S21: rejects path traversal /owner/properties/../etc/passwd → null', () => {
		expect(call('/owner/properties/../etc/passwd')).toBeNull();
	});

	// S-S22 — FR-S14: trailing slash / empty propertyAssetId segment
	it('S-S22: rejects /owner/properties/ (trailing slash, empty segment) → null', () => {
		expect(call('/owner/properties/')).toBeNull();
	});

	// S-S23 — FR-S14: bare /owner/properties (no segment)
	it('S-S23: rejects /owner/properties (no propertyAssetId segment) → null', () => {
		expect(call('/owner/properties')).toBeNull();
	});

	// S-S24 — FR-S9: duplicate movement param (HTTP parameter pollution)
	it('S-S24: rejects ?tab=tracking&movement=mov-1&movement=mov-2 (duplicate) → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=tracking&movement=mov-1&movement=mov-2'),
		).toBeNull();
	});

	// S-S25 — FR-S15: fragment + query params
	it('S-S25: rejects ?tab=tracking&movement=mov-123#section (fragment) → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=tracking&movement=mov-123#section'),
		).toBeNull();
	});

	// S-S26 — FR-S15: bare fragment on property path
	it('S-S26: rejects /owner/properties/asset-abc#section (bare fragment) → null', () => {
		expect(call('/owner/properties/asset-abc#section')).toBeNull();
	});

	// S-S27 — empty string
	it('S-S27: rejects empty string → null', () => {
		expect(call('')).toBeNull();
	});

	// S-S28 — null/undefined input → null, no throw
	it('S-S28 (null): rejects null input without throwing → null', () => {
		expect(call(null)).toBeNull();
	});
	it('S-S28 (undefined): rejects undefined input without throwing → null', () => {
		expect(call(undefined)).toBeNull();
	});

	// S-S29 — cross-surface: internal product path → null
	it('S-S29: rejects /dashboard/product/eng-abc?doc=req-123 (cross-surface) → null', () => {
		expect(call('/dashboard/product/eng-abc?doc=req-123')).toBeNull();
	});
});

// 2j — Fast-path preservation (S-S30..S-S31)
describe('sanitizeOwnerNotificationLink — 24.6c — fast-path preservation', () => {
	// S-S30 — FR-S10: /owner fast-path
	it('S-S30: /owner fast-path returns /owner unchanged', () => {
		expect(call('/owner')).toBe('/owner');
	});

	// S-S31 — FR-S11: bare /owner/properties/{assetId} fast-path
	it('S-S31: bare /owner/properties/asset-abc fast-path returns unchanged', () => {
		expect(call('/owner/properties/asset-abc')).toBe('/owner/properties/asset-abc');
	});
});

// ---------------------------------------------------------------------------
// sanitizeInternalNotificationLink — 24.6b internal {doc}-only allowlist
// ---------------------------------------------------------------------------

const ENG_ID = 'eng-abc';
const icall = (linkHref: unknown, engagementId: unknown = ENG_ID) =>
	sanitizeInternalNotificationLink({
		linkHref: linkHref as string | null | undefined,
		propertyEngagementId: engagementId as string | null | undefined,
	});

// ---------------------------------------------------------------------------
// 2a — SAFE_INTERNAL_LINKS regression (S-S1..S-S4)
// ---------------------------------------------------------------------------
describe('sanitizeInternalNotificationLink — SAFE_INTERNAL_LINKS regression (S-S1..S-S4)', () => {
	// S-S1 — FR-S2: /dashboard static link
	it('S-S1: returns /dashboard unchanged (SAFE_INTERNAL_LINKS fast-path)', () => {
		expect(icall('/dashboard', null)).toBe('/dashboard');
	});

	// S-S2 — FR-S2: /dashboard/seguimiento
	it('S-S2: returns /dashboard/seguimiento unchanged (SAFE_INTERNAL_LINKS fast-path)', () => {
		expect(icall('/dashboard/seguimiento', null)).toBe('/dashboard/seguimiento');
	});

	// S-S3 — FR-S2: /dashboard/users
	it('S-S3: returns /dashboard/users unchanged (SAFE_INTERNAL_LINKS fast-path)', () => {
		expect(icall('/dashboard/users', null)).toBe('/dashboard/users');
	});

	// S-S4 — FR-S2: /dashboard/status-change-requests
	it('S-S4: returns /dashboard/status-change-requests unchanged (SAFE_INTERNAL_LINKS fast-path)', () => {
		expect(icall('/dashboard/status-change-requests', null)).toBe(
			'/dashboard/status-change-requests',
		);
	});
});

// ---------------------------------------------------------------------------
// 2b — Param-less product path acceptance (S-S5) — regression guard
// ---------------------------------------------------------------------------
describe('sanitizeInternalNotificationLink — param-less product path (S-S5)', () => {
	// S-S5 — FR-S3: historical param-less product link
	it('S-S5: returns /dashboard/product/eng-abc unchanged (historical regression guard)', () => {
		expect(icall('/dashboard/product/eng-abc')).toBe('/dashboard/product/eng-abc');
	});
});

// ---------------------------------------------------------------------------
// 2c — Deep-link acceptance (S-S6, S-S7) — core new acceptance cases
// ---------------------------------------------------------------------------
describe('sanitizeInternalNotificationLink — deep-link acceptance (S-S6, S-S7)', () => {
	// S-S6 — FR-S4: full deep-link accepted
	it('S-S6: accepts /dashboard/product/eng-abc?doc=req-123 (core deep-link)', () => {
		expect(icall('/dashboard/product/eng-abc?doc=req-123')).toBe(
			'/dashboard/product/eng-abc?doc=req-123',
		);
	});

	// S-S7 — FR-S4: UUID-format doc value accepted
	it('S-S7: accepts UUID doc value 550e8400-e29b-41d4-a716-446655440000', () => {
		expect(
			icall('/dashboard/product/eng-abc?doc=550e8400-e29b-41d4-a716-446655440000'),
		).toBe('/dashboard/product/eng-abc?doc=550e8400-e29b-41d4-a716-446655440000');
	});
});

// ---------------------------------------------------------------------------
// 2d — Rejection cases (S-S8..S-S25) — SECURITY-CRITICAL
// ---------------------------------------------------------------------------
describe('sanitizeInternalNotificationLink — rejection cases (SECURITY-CRITICAL)', () => {
	// S-S8 — FR-S5: unknown param → null
	it('S-S8: rejects unknown param evil=x → null', () => {
		expect(icall('/dashboard/product/eng-abc?doc=req-123&evil=x')).toBeNull();
	});

	// S-S9 — FR-S5 CRITICAL: tab is NOT in the internal allowlist
	it('S-S9: rejects tab param (doc+tab) → null (tab not in internal allowlist)', () => {
		expect(icall('/dashboard/product/eng-abc?doc=req-123&tab=documentos')).toBeNull();
	});

	// S-S10 — FR-S5: tab alone → null
	it('S-S10: rejects tab alone (no doc) → null', () => {
		expect(icall('/dashboard/product/eng-abc?tab=documentos')).toBeNull();
	});

	// S-S11 — FR-S5: open redirect param → null
	it('S-S11: rejects redirect param → null', () => {
		expect(icall('/dashboard/product/eng-abc?redirect=http://evil.com')).toBeNull();
	});

	// S-S12 — FR-S6: empty doc value → null
	it('S-S12: rejects empty doc value (?doc=) → null', () => {
		expect(icall('/dashboard/product/eng-abc?doc=')).toBeNull();
	});

	// S-S13 — FR-S7: duplicate doc param → null
	it('S-S13: rejects duplicate doc param → null', () => {
		expect(icall('/dashboard/product/eng-abc?doc=req-1&doc=req-2')).toBeNull();
	});

	// S-S14 — FR-S8: protocol-relative URL → null
	it('S-S14: rejects protocol-relative URL (//host) → null', () => {
		expect(icall('//evil.example.com/dashboard/product/eng-abc')).toBeNull();
	});

	// S-S15 — FR-S8, FR-S11: absolute URL → null
	it('S-S15: rejects absolute URL (https://evil.example.com/...) → null', () => {
		expect(
			icall('https://evil.example.com/dashboard/product/eng-abc'),
		).toBeNull();
	});

	// S-S16 — FR-S8, FR-S11: absolute URL + doc → null
	it('S-S16: rejects absolute URL with doc param → null', () => {
		expect(
			icall('https://evil.example.com/dashboard/product/eng-abc?doc=req-123'),
		).toBeNull();
	});

	// S-S17 — FR-S9: trailing slash, empty segment → null
	it('S-S17: rejects /dashboard/product/ (trailing slash, empty segment) → null', () => {
		expect(icall('/dashboard/product/')).toBeNull();
	});

	// S-S18 — FR-S9: no segment at all → null
	it('S-S18: rejects /dashboard/product (no segment) → null', () => {
		expect(icall('/dashboard/product')).toBeNull();
	});

	// S-S19 — FR-S9: path traversal → null
	it('S-S19: rejects path traversal /dashboard/product/../etc/passwd → null', () => {
		expect(icall('/dashboard/product/../etc/passwd')).toBeNull();
	});

	// S-S20 — FR-S9: SAFE_INTERNAL_LINKS member + query param → null
	it('S-S20: rejects /dashboard/seguimiento?doc=req-123 (static-set member + param) → null', () => {
		expect(icall('/dashboard/seguimiento?doc=req-123')).toBeNull();
	});

	// S-S21 — FR-S10: fragment + doc → null
	it('S-S21: rejects fragment alongside doc param → null', () => {
		expect(icall('/dashboard/product/eng-abc?doc=req-123#section')).toBeNull();
	});

	// S-S22 — FR-S10: bare fragment on product path → null
	it('S-S22: rejects bare fragment on product path → null', () => {
		expect(icall('/dashboard/product/eng-abc#section')).toBeNull();
	});

	// S-S23 — empty string → null
	it('S-S23: rejects empty string → null', () => {
		expect(icall('')).toBeNull();
	});

	// S-S24 — null/undefined → null, no throw
	it('S-S24 (null): returns null for null input without throwing', () => {
		expect(icall(null)).toBeNull();
	});
	it('S-S24 (undefined): returns null for undefined input without throwing', () => {
		expect(icall(undefined)).toBeNull();
	});

	// S-S25 — cross-surface: owner path → null
	it('S-S25: rejects owner path /owner/properties/... → null (cross-surface isolation)', () => {
		expect(icall('/owner/properties/asset-abc?tab=documents&doc=req-123')).toBeNull();
	});

	// S-S26 — TRUST BOUNDARY (core security property): the link's path engagementId
	// MUST equal the trusted `propertyEngagementId` argument (the DB column). A link
	// that points at a DIFFERENT engagement than the notification's trusted column is
	// rejected — this is the pathname-vs-trusted-column equality (step 5c).
	it('S-S26: rejects tampered engagementId (path eng-OTHER vs trusted eng-abc) → null', () => {
		expect(
			sanitizeInternalNotificationLink({
				linkHref: '/dashboard/product/eng-OTHER?doc=req-1',
				propertyEngagementId: 'eng-abc',
			}),
		).toBeNull();
	});

	// S-S27 — open-redirect via backslash host. URL() treats `/\evil.com` as a host,
	// yielding origin https://evil.com, which the origin assertion (step 5b) rejects.
	it('S-S27: rejects backslash-host open redirect (/\\evil.com/...) → null', () => {
		expect(icall('/\\evil.com/dashboard/product/eng-abc?doc=1')).toBeNull();
	});

	// S-S28 — double backslash-host open redirect → null (same origin-assertion guard).
	it('S-S28: rejects double backslash-host open redirect (/\\/\\evil.com/...) → null', () => {
		expect(icall('/\\/\\evil.com/dashboard/product/eng-abc?doc=1')).toBeNull();
	});

	// S-S29 — percent-encoded KEY acceptance: `%64oc` decodes to `doc` via
	// searchParams.keys(), so the decoded-key allowlist (step 5d) accepts it. This
	// locks the decoded-key contract: the allowlist matches on decoded names, and the
	// canonical return preserves the original (encoded) search string.
	it('S-S29: accepts percent-encoded doc key (?%64oc=req-1) → canonical link', () => {
		expect(icall('/dashboard/product/eng-abc?%64oc=req-1')).toBe(
			'/dashboard/product/eng-abc?%64oc=req-1',
		);
	});
});
